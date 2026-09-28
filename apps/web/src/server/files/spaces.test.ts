import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const remote = vi.hoisted(() => ({
  objects: new Map<string, { bytes: Buffer; modifiedAt: Date }>(),
  send: vi.fn(),
  configs: [] as unknown[],
  failure: "",
}));
vi.mock("@aws-sdk/client-s3", async (original) => {
  const actual = await original<typeof import("@aws-sdk/client-s3")>();
  return {
    ...actual,
    S3Client: class {
      constructor(config: unknown) {
        remote.configs.push(config);
      }
      send = remote.send;
    },
  };
});
import { createFilesystemStorage, createSpacesStorage, getFileStorage } from "./backend";
import { spacesConfiguration } from "./config";
import { deletePrivateFile, readPrivateFile, storePrivateFile } from "./storage";
import { cleanupFilePage } from "./cleanup";

const env = {
  NODE_ENV: "production",
  FILE_STORAGE_BACKEND: "spaces",
  SPACES_REGION: "ams3",
  SPACES_ENDPOINT: "https://ams3.digitaloceanspaces.com",
  SPACES_BUCKET: "private-beta",
  SPACES_PREFIX: "community-beta/",
  SPACES_ACCESS_KEY_ID: "mock",
  SPACES_SECRET_ACCESS_KEY: "mock-secret",
};
const file = () => new File(["beta evidence"], "misleading.exe", { type: "image/png" });
const old = new Date("2025-01-01");
const cleanKey = "clean/2025-01-01/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.txt";

beforeEach(() => {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  remote.objects.clear();
  remote.configs.length = 0;
  remote.failure = "";
  remote.send.mockReset().mockImplementation(async (command) => {
    const input = command.input;
    const kind = command.constructor.name;
    if (remote.failure === kind) throw new Error("Spaces unavailable");
    if (kind === "PutObjectCommand")
      remote.objects.set(input.Key, { bytes: Buffer.from(input.Body), modifiedAt: new Date() });
    if (kind === "DeleteObjectCommand") remote.objects.delete(input.Key);
    if (kind === "GetObjectCommand") {
      const object = remote.objects.get(input.Key);
      if (!object) throw Object.assign(new Error("missing"), { name: "NoSuchKey" });
      return { Body: { transformToByteArray: async () => object.bytes } };
    }
    if (kind === "ListObjectsV2Command")
      return {
        Contents: [...remote.objects.entries()]
          .filter(([key]) => key.startsWith(input.Prefix))
          .map(([Key, value]) => ({ Key, LastModified: value.modifiedAt })),
      };
    return {};
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("private Spaces lifecycle", () => {
  it("scans quarantined bytes before promotion and returns compatible metadata", async () => {
    const scan = vi.fn(async (bytes: Buffer) => {
      expect([...remote.objects.keys()]).toHaveLength(1);
      expect([...remote.objects.keys()][0]).toMatch(/^community-beta\/quarantine\//);
      expect(bytes.toString()).toBe("beta evidence");
      return "CLEAN" as const;
    });
    const stored = await storePrivateFile(file(), {}, { storage: getFileStorage(), scan });
    expect(stored).toMatchObject({
      scanStatus: "CLEAN",
      contentType: "text/plain",
      sizeBytes: 13,
      sha256: createHash("sha256").update("beta evidence").digest("hex"),
    });
    expect([...remote.objects.keys()]).toEqual([env.SPACES_PREFIX + stored.storageKey]);
    for (const [command] of remote.send.mock.calls.filter(
      ([c]) => c.constructor.name === "PutObjectCommand",
    )) {
      expect(command.input).toMatchObject({
        ACL: "private",
        CacheControl: "private, no-store",
        ContentType: "text/plain",
      });
    }
    expect(Buffer.from(await readPrivateFile(stored.storageKey)).toString()).toBe("beta evidence");
  });

  it.each(["malware", "outage"])(
    "fails closed on scanner %s without a clean object",
    async (mode) => {
      const scan = vi.fn(async () => {
        if (mode === "outage") throw new Error("scanner down");
        return "INFECTED" as const;
      });
      await expect(
        storePrivateFile(file(), {}, { storage: getFileStorage(), scan }),
      ).rejects.toMatchObject({ status: mode === "malware" ? 422 : 503 });
      expect(remote.objects.size).toBe(0);
      expect(
        remote.send.mock.calls.filter(([c]) => c.constructor.name === "PutObjectCommand"),
      ).toHaveLength(1);
    },
  );

  it("does not scan or return metadata when quarantine storage is unavailable", async () => {
    remote.failure = "PutObjectCommand";
    const scan = vi.fn();
    await expect(
      storePrivateFile(file(), {}, { storage: getFileStorage(), scan }),
    ).rejects.toMatchObject({ code: "FILE_STORAGE_UNAVAILABLE" });
    expect(scan).not.toHaveBeenCalled();
  });

  it("removes ambiguous writes when promotion fails after the remote PUT succeeded", async () => {
    const storage = getFileStorage();
    const original = storage.promote;
    storage.promote = async (...args) => {
      await original(...args);
      throw new Error("response lost");
    };
    await expect(
      storePrivateFile(file(), {}, { storage, scan: async () => "CLEAN" }),
    ).rejects.toMatchObject({ code: "FILE_STORAGE_UNAVAILABLE" });
    expect(remote.objects.size).toBe(0);
  });

  it("leaves recoverable orphans when cleanup is also unavailable, preserving the scan error", async () => {
    remote.failure = "DeleteObjectCommand";
    await expect(
      storePrivateFile(file(), {}, { storage: getFileStorage(), scan: async () => "INFECTED" }),
    ).rejects.toMatchObject({ code: "FILE_INFECTED" });
    expect([...remote.objects.keys()].every((key) => key.includes("/quarantine/"))).toBe(true);
  });

  it("validates content and size before any storage write", async () => {
    const dependencies = { storage: getFileStorage(), scan: vi.fn() };
    for (const invalid of [new File([], "empty"), new File(["too big"], "large")])
      await expect(storePrivateFile(invalid, { maxBytes: 2 }, dependencies)).rejects.toMatchObject({
        status: 413,
      });
    await expect(
      storePrivateFile(new File([new Uint8Array([0, 1])], "fake.png"), {}, dependencies),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      storePrivateFile(file(), { allowedTypes: ["image/png"] }, dependencies),
    ).rejects.toMatchObject({ status: 415 });
    expect(remote.send).not.toHaveBeenCalled();
  });

  it("denies quarantine and traversal downloads before touching Spaces", async () => {
    await expect(readPrivateFile(cleanKey.replace("clean/", "quarantine/"))).rejects.toMatchObject({
      status: 404,
    });
    await expect(readPrivateFile("clean/../quarantine/file.txt")).rejects.toMatchObject({
      status: 400,
    });
    expect(remote.send).not.toHaveBeenCalled();
  });

  it("keeps files across new clients/redeployment and ignores ephemeral filesystem roots", async () => {
    const stored = await storePrivateFile(
      file(),
      {},
      { storage: createSpacesStorage(), scan: async () => "CLEAN" },
    );
    vi.stubEnv("FILE_STORAGE_ROOT", "/nonexistent/redeployed-container");
    const restarted = createSpacesStorage();
    expect((await restarted.read(stored.storageKey)).toString()).toBe("beta evidence");
    expect(remote.configs.length).toBeGreaterThan(1);
    await deletePrivateFile(stored.storageKey);
    await deletePrivateFile(stored.storageKey); // S3 deletion is idempotent.
    await expect(readPrivateFile(stored.storageKey)).rejects.toMatchObject({ status: 404 });
  });

  it("reports read/delete outages without returning content", async () => {
    remote.failure = "GetObjectCommand";
    await expect(readPrivateFile(cleanKey)).rejects.toMatchObject({ status: 503 });
    remote.failure = "DeleteObjectCommand";
    await expect(deletePrivateFile(cleanKey)).rejects.toMatchObject({ status: 503 });
  });

  it("cannot fall back to filesystem or send credentials to a non-Spaces endpoint", () => {
    vi.stubEnv("FILE_STORAGE_BACKEND", "filesystem");
    expect(() => getFileStorage()).toThrow("Durable file storage");
    expect(() =>
      spacesConfiguration({ ...env, SPACES_ENDPOINT: "https://other.example" }),
    ).toThrow();
    expect(() => spacesConfiguration({ ...env, SPACES_PREFIX: "../" })).toThrow();
    expect(() => spacesConfiguration({ ...env, SPACES_SECRET_ACCESS_KEY: "" })).toThrow();
  });
});

describe("reference-aware orphan cleanup", () => {
  it("preserves referenced and recent files, defaults to dry run, and retries old orphans", async () => {
    remote.objects.set(env.SPACES_PREFIX + cleanKey, {
      bytes: Buffer.from("orphan"),
      modifiedAt: old,
    });
    const live = cleanKey.replace("aaaaaaaa", "bbbbbbbb");
    remote.objects.set(env.SPACES_PREFIX + live, { bytes: Buffer.from("live"), modifiedAt: old });
    const recent = cleanKey.replace("aaaaaaaa", "cccccccc");
    remote.objects.set(env.SPACES_PREFIX + recent, {
      bytes: Buffer.from("pending metadata"),
      modifiedAt: new Date(),
    });
    const options = {
      storage: getFileStorage(),
      isReferenced: vi.fn(async (key: string) => key === live),
      prefix: "clean/" as const,
    };
    expect(await cleanupFilePage(options)).toMatchObject({
      candidates: 1,
      deleted: 0,
      dryRun: true,
    });
    expect(await cleanupFilePage({ ...options, dryRun: false })).toMatchObject({ deleted: 1 });
    expect(remote.objects.has(env.SPACES_PREFIX + live)).toBe(true);
    expect(remote.objects.has(env.SPACES_PREFIX + recent)).toBe(true);
    expect(options.isReferenced).not.toHaveBeenCalledWith(recent);
  });

  it("aborts on database failure without deleting objects", async () => {
    remote.objects.set(env.SPACES_PREFIX + cleanKey, {
      bytes: Buffer.from("keep"),
      modifiedAt: old,
    });
    await expect(
      cleanupFilePage({
        storage: getFileStorage(),
        prefix: "clean/",
        dryRun: false,
        isReferenced: async () => {
          throw new Error("database down");
        },
      }),
    ).rejects.toThrow("database down");
    expect(remote.objects.size).toBe(1);
  });

  it("keeps pagination scoped to the environment and requested prefix", async () => {
    remote.send.mockResolvedValueOnce({
      IsTruncated: true,
      NextContinuationToken: "next",
      Contents: [
        { Key: env.SPACES_PREFIX + cleanKey, LastModified: old },
        { Key: "another-beta/" + cleanKey, LastModified: old },
      ],
    });
    const page = await getFileStorage().list("clean/", "previous");
    expect(page).toEqual({ objects: [{ key: cleanKey, modifiedAt: old }], cursor: "next" });
    expect(remote.send.mock.calls[0][0].input).toMatchObject({
      Prefix: "community-beta/clean/",
      ContinuationToken: "previous",
    });
  });
});

it("retains local filesystem upload/download/delete for development", async () => {
  const root = await mkdtemp(join(tmpdir(), "klaveroq-storage-"));
  try {
    const storage = createFilesystemStorage(root);
    const stored = await storePrivateFile(file(), {}, { storage, scan: async () => "CLEAN" });
    expect((await storage.read(stored.storageKey)).toString()).toBe("beta evidence");
    expect((await storage.list("quarantine/")).objects).toEqual([]);
    await storage.delete(stored.storageKey);
    await storage.delete(stored.storageKey);
    expect((await storage.list("clean/")).objects).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
