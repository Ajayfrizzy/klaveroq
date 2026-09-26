import { createHash, randomUUID } from "node:crypto";
import { createConnection } from "node:net";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { ApiError } from "../http/errors";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const MAX_PROOF_BYTES = 100 * 1024 * 1024;
export const MAX_PROOF_FILES = 10;

export type DetectedFileType =
  "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | "text/plain";
type FilePolicy = { allowedTypes?: DetectedFileType[]; maxBytes?: number };
type FileScannerEnvironment = Record<string, string | undefined>;

const extensions: Record<DetectedFileType, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
};

function storageRoot() {
  return process.env.FILE_STORAGE_ROOT
    ? resolve(process.env.FILE_STORAGE_ROOT)
    : resolve(/* turbopackIgnore: true */ process.cwd(), "../../.data/uploads");
}

function storagePath(storageKey: string) {
  const root = storageRoot();
  const target = resolve(root, storageKey);
  if (target === root || !target.startsWith(`${root}${sep}`))
    throw new ApiError(400, "FILE_KEY_INVALID", "The file key is invalid.");
  return target;
}

export function detectFileType(bytes: Uint8Array): DetectedFileType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"
  )
    return "image/webp";
  if (bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-")
    return "application/pdf";
  if (bytes.length && !bytes.includes(0)) {
    try {
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (
        ![...decoded].some((character) => {
          const code = character.charCodeAt(0);
          return (code < 32 && ![9, 10, 13].includes(code)) || code === 127;
        })
      )
        return "text/plain";
    } catch {
      return null;
    }
  }
  return null;
}

export function allowsLocalFileScanner(environment: FileScannerEnvironment = process.env) {
  if (environment.NODE_ENV !== "production") return true;
  if (environment.E2E_TEST_MODE !== "1" || !environment.DATABASE_URL) return false;
  try {
    const database = new URL(environment.DATABASE_URL);
    return (
      ["127.0.0.1", "localhost", "::1"].includes(database.hostname) &&
      database.pathname.slice(1).endsWith("_test")
    );
  } catch {
    return false;
  }
}

async function scanWithClamAv(bytes: Buffer) {
  const host = process.env.CLAMAV_HOST;
  const port = Number(process.env.CLAMAV_PORT ?? 3310);
  if (!host || !Number.isInteger(port) || port < 1)
    throw new ApiError(503, "FILE_SCANNER_UNAVAILABLE", "File scanning is not configured.");
  return new Promise<"CLEAN" | "INFECTED">((resolvePromise, reject) => {
    const socket = createConnection({ host, port });
    const chunks: Buffer[] = [];
    const fail = (error?: Error) => {
      socket.destroy();
      reject(error ?? new Error("File scanner connection failed."));
    };
    socket.setTimeout(10_000, () => fail(new Error("File scanner timed out.")));
    socket.on("error", fail);
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < bytes.length; offset += 64 * 1024) {
        const chunk = bytes.subarray(offset, offset + 64 * 1024);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length);
        socket.write(size);
        socket.write(chunk);
      }
      socket.end(Buffer.alloc(4));
    });
    socket.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    socket.on("end", () => {
      const response = Buffer.concat(chunks).toString("utf8");
      if (response.includes(" FOUND")) resolvePromise("INFECTED");
      else if (response.includes(" OK")) resolvePromise("CLEAN");
      else reject(new Error("File scanner returned an invalid response."));
    });
  });
}

export async function scanFileBytes(bytes: Buffer) {
  const scanner =
    process.env.FILE_SCANNER ?? (process.env.NODE_ENV === "production" ? "" : "local");
  if (scanner === "local" && allowsLocalFileScanner())
    return bytes.toString("ascii").includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")
      ? ("INFECTED" as const)
      : ("CLEAN" as const);
  if (scanner === "clamav") return scanWithClamAv(bytes);
  throw new ApiError(503, "FILE_SCANNER_UNAVAILABLE", "File scanning is not configured.");
}

export async function storePrivateFile(file: File, policy: FilePolicy = {}) {
  const maxBytes = policy.maxBytes ?? MAX_FILE_BYTES;
  if (file.size < 1 || file.size > maxBytes)
    throw new ApiError(
      413,
      "FILE_SIZE_INVALID",
      `The file must be between 1 byte and ${Math.floor(maxBytes / 1024 / 1024)} MB.`,
    );
  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = detectFileType(bytes);
  const allowedTypes = policy.allowedTypes ?? (Object.keys(extensions) as DetectedFileType[]);
  if (!contentType || !allowedTypes.includes(contentType))
    throw new ApiError(
      415,
      "FILE_TYPE_UNSUPPORTED",
      "The file contents use an unsupported format.",
    );

  const date = new Date().toISOString().slice(0, 10);
  const filename = `${randomUUID()}${extensions[contentType]}`;
  const quarantineKey = `quarantine/${date}/${filename}`;
  const cleanKey = `clean/${date}/${filename}`;
  const quarantinePath = storagePath(quarantineKey);
  await mkdir(dirname(quarantinePath), { recursive: true });
  await writeFile(quarantinePath, bytes, { flag: "wx", mode: 0o600 });
  try {
    if ((await scanFileBytes(bytes)) !== "CLEAN")
      throw new ApiError(422, "FILE_INFECTED", "The file failed the malware scan.");
    const cleanPath = storagePath(cleanKey);
    await mkdir(dirname(cleanPath), { recursive: true });
    await rename(quarantinePath, cleanPath);
    return {
      storageKey: cleanKey,
      contentType,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      sizeBytes: bytes.length,
      scanStatus: "CLEAN" as const,
    };
  } catch (error) {
    await rm(quarantinePath, { force: true });
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "FILE_SCAN_FAILED", "The file could not be scanned. Try again later.");
  }
}

export async function readPrivateFile(storageKey: string) {
  if (!storageKey.startsWith("clean/"))
    throw new ApiError(404, "FILE_NOT_AVAILABLE", "The file is not available.");
  return readFile(storagePath(storageKey));
}

export async function deletePrivateFile(storageKey: string) {
  await rm(storagePath(storageKey), { force: true });
}
