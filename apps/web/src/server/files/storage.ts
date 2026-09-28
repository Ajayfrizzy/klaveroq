import { createHash, randomUUID } from "node:crypto";
import { ApiError } from "../http/errors";
import { getFileStorage, assertStorageKey, type FileStorage } from "./backend";
import { scanFileBytes } from "./scanner";
export { scanFileBytes, allowsLocalFileScanner } from "./scanner";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const MAX_PROOF_BYTES = 100 * 1024 * 1024;
export const MAX_PROOF_FILES = 10;

export type DetectedFileType =
  "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | "text/plain";
type FilePolicy = { allowedTypes?: DetectedFileType[]; maxBytes?: number };

const extensions: Record<DetectedFileType, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
};

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

export async function storePrivateFile(
  file: File,
  policy: FilePolicy = {},
  dependencies: { storage: FileStorage; scan: typeof scanFileBytes } = {
    storage: getFileStorage(),
    scan: scanFileBytes,
  },
) {
  const maxBytes = policy.maxBytes ?? MAX_FILE_BYTES;
  if (file.size < 1 || file.size > maxBytes)
    throw new ApiError(
      413,
      "FILE_SIZE_INVALID",
      `The file must be between 1 byte and ${Math.floor(maxBytes / 1024 / 1024)} MB.`,
    );
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || bytes.length > maxBytes)
    throw new ApiError(413, "FILE_SIZE_INVALID", "The file size is invalid.");
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
  const { storage, scan } = dependencies;
  let phase: "storage" | "scan" = "storage";
  try {
    await storage.put(quarantineKey, bytes, contentType);
    phase = "scan";
    if ((await scan(bytes)) !== "CLEAN")
      throw new ApiError(422, "FILE_INFECTED", "The file failed the malware scan.");
    phase = "storage";
    await storage.promote(quarantineKey, cleanKey, bytes, contentType);
    return {
      storageKey: cleanKey,
      contentType,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      sizeBytes: bytes.length,
      scanStatus: "CLEAN" as const,
    };
  } catch (error) {
    // A timed-out PUT may have succeeded remotely. Attempt both keys, and let
    // reference-aware orphan cleanup retry after an outage or process crash.
    await Promise.allSettled([storage.delete(quarantineKey), storage.delete(cleanKey)]);
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      503,
      phase === "scan" ? "FILE_SCAN_FAILED" : "FILE_STORAGE_UNAVAILABLE",
      phase === "scan"
        ? "The file could not be scanned. Try again later."
        : "File storage is unavailable. Try again later.",
    );
  }
}

export async function readPrivateFile(storageKey: string) {
  if (!storageKey.startsWith("clean/"))
    throw new ApiError(404, "FILE_NOT_AVAILABLE", "The file is not available.");
  assertStorageKey(storageKey);
  try {
    return new Uint8Array(await getFileStorage().read(storageKey));
  } catch (error) {
    if (
      (error as { name?: string }).name === "NoSuchKey" ||
      (error as NodeJS.ErrnoException).code === "ENOENT"
    )
      throw new ApiError(404, "FILE_NOT_AVAILABLE", "The file is not available.");
    throw new ApiError(503, "FILE_STORAGE_UNAVAILABLE", "File storage is unavailable.");
  }
}

export async function deletePrivateFile(storageKey: string) {
  assertStorageKey(storageKey);
  try {
    await getFileStorage().delete(storageKey);
  } catch {
    throw new ApiError(503, "FILE_STORAGE_UNAVAILABLE", "File storage is unavailable.");
  }
}
