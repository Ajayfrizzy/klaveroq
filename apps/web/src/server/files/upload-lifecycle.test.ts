import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  store: vi.fn(),
  remove: vi.fn(),
  transaction: vi.fn(),
  owner: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  deleteMetadata: vi.fn(),
}));
vi.mock("@/server/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/server/audit", () => ({ audit: vi.fn() }));
vi.mock("@/features/talent/server/access", () => ({ requirePortfolioOwner: mocks.owner }));
vi.mock("@/server/files/storage", () => ({
  storePrivateFile: mocks.store,
  deletePrivateFile: mocks.remove,
  MAX_AVATAR_BYTES: 5 * 1024 * 1024,
}));
vi.mock("@/server/db", () => ({ db: { transaction: mocks.transaction } }));
import { POST as avatarPost, DELETE as avatarDelete } from "@/app/api/profile/avatar/route";
import {
  POST as portfolioPost,
  DELETE as portfolioDelete,
} from "@/app/api/profile/portfolio/[id]/media/route";
import { ApiError } from "../http/errors";

const stored = {
  storageKey: "clean/2026-09-28/new.png",
  contentType: "image/png",
  sizeBytes: 8,
  sha256: "hash",
  scanStatus: "CLEAN",
};
const prior = "clean/2026-09-27/prior.png";
const context = { params: Promise.resolve({ id: "portfolio-id" }) };
const request = (method = "POST") => {
  const form = new FormData();
  form.set("file", new File(["mock image"], "image.png"));
  form.set("altText", "Example photo");
  return new Request("https://beta.example/api/profile/avatar", {
    method,
    headers: { origin: "https://beta.example" },
    ...(method === "POST" ? { body: form } : {}),
  });
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_URL", "https://beta.example");
  mocks.requireUser.mockResolvedValue({
    user: { id: "owner" },
    profile: { avatarKey: prior, displayName: "Owner" },
  });
  mocks.owner.mockResolvedValue({ mediaKey: prior });
  mocks.store.mockResolvedValue(stored);
  mocks.remove.mockResolvedValue(undefined);
  mocks.insert.mockResolvedValue(undefined);
  mocks.update.mockResolvedValue(undefined);
  mocks.deleteMetadata.mockResolvedValue(undefined);
  mocks.transaction.mockImplementation(async (callback) =>
    callback({
      insert: () => ({ values: mocks.insert }),
      update: () => ({ set: (value: unknown) => ({ where: () => mocks.update(value) }) }),
      delete: () => ({ where: mocks.deleteMetadata }),
    }),
  );
});
afterEach(() => vi.unstubAllEnvs());

describe("upload metadata and replacement lifecycle", () => {
  it.each([avatarPost, portfolioPost])(
    "commits scanned metadata before deleting a replaced object",
    async (route) => {
      const response = await route(request(), context);
      expect(response.status).toBe(201);
      expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining(stored));
      expect(mocks.remove).toHaveBeenCalledWith(prior);
      expect(mocks.remove).not.toHaveBeenCalledWith(stored.storageKey);
      expect(mocks.transaction.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.remove.mock.invocationCallOrder[0],
      );
    },
  );
  it.each([avatarPost, portfolioPost])(
    "rolls back the new object if metadata cannot commit",
    async (route) => {
      mocks.transaction.mockRejectedValue(new ApiError(503, "DATABASE_UNAVAILABLE", "Unavailable"));
      expect((await route(request(), context)).status).toBe(503);
      expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(stored.storageKey);
      expect(mocks.remove).not.toHaveBeenCalledWith(prior);
    },
  );
  it.each([avatarPost, portfolioPost])(
    "does not write metadata for a scanner or storage failure",
    async (route) => {
      mocks.store.mockRejectedValue(new ApiError(503, "FILE_SCAN_FAILED", "Unavailable"));
      expect((await route(request(), context)).status).toBe(503);
      expect(mocks.transaction).not.toHaveBeenCalled();
      expect(mocks.remove).not.toHaveBeenCalled();
    },
  );
  it.each([avatarDelete, portfolioDelete])(
    "removes references before deleting the stored object",
    async (route) => {
      expect((await route(request("DELETE"), context)).status).toBe(204);
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining(route === avatarDelete ? { avatarKey: null } : { mediaKey: null }),
      );
      expect(mocks.deleteMetadata).toHaveBeenCalled();
      expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(prior);
    },
  );
  it("denies an unauthorized portfolio upload before storing bytes", async () => {
    mocks.owner.mockRejectedValue(new ApiError(404, "PORTFOLIO_ITEM_NOT_FOUND", "Not found"));
    expect((await portfolioPost(request(), context)).status).toBe(404);
    expect(mocks.store).not.toHaveBeenCalled();
  });
  it("rejects a cross-origin upload before storing bytes", async () => {
    const invalid = new Request("https://beta.example/api/profile/avatar", {
      method: "POST",
      headers: { origin: "https://other.example" },
    });
    expect((await avatarPost(invalid)).status).toBe(403);
    expect(mocks.store).not.toHaveBeenCalled();
  });
});
