import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { ApiError } from "../http/errors";
import { spacesConfiguration } from "./config";
import { allowsLocalFileScanner } from "./scanner";

export type StoredObject = { key: string; modifiedAt: Date };
export interface FileStorage {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  promote(
    quarantineKey: string,
    cleanKey: string,
    bytes: Buffer,
    contentType: string,
  ): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  list(
    prefix: "clean/" | "quarantine/",
    cursor?: string,
  ): Promise<{
    objects: StoredObject[];
    cursor?: string;
  }>;
}

export function assertStorageKey(key: string) {
  if (!/^(clean|quarantine)\/\d{4}-\d{2}-\d{2}\/[a-zA-Z0-9-]+\.(jpg|png|webp|pdf|txt)$/.test(key))
    throw new ApiError(400, "FILE_KEY_INVALID", "The file key is invalid.");
}

export function createFilesystemStorage(root: string): FileStorage {
  const path = (key: string) => {
    assertStorageKey(key);
    const target = resolve(root, key);
    if (!target.startsWith(`${resolve(root)}${sep}`)) throw new Error("Invalid storage path.");
    return target;
  };
  return {
    async put(key, bytes) {
      await mkdir(dirname(path(key)), { recursive: true });
      await writeFile(path(key), bytes, { flag: "wx", mode: 0o600 });
    },
    async promote(source, destination) {
      await mkdir(dirname(path(destination)), { recursive: true });
      await rename(path(source), path(destination));
    },
    read: (key) => readFile(path(key)),
    delete: (key) => rm(path(key), { force: true }),
    async list(prefix, cursor) {
      const objects: StoredObject[] = [];
      const base = resolve(root, prefix);
      let dates;
      try {
        dates = await readdir(base, { withFileTypes: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return { objects };
        throw error;
      }
      for (const date of dates) {
        if (!date.isDirectory() || !/^\d{4}-\d{2}-\d{2}$/.test(date.name)) continue;
        for (const file of await readdir(resolve(base, date.name), { withFileTypes: true })) {
          if (!file.isFile()) continue;
          const key = `${prefix}${date.name}/${file.name}`;
          try {
            assertStorageKey(key);
          } catch {
            continue;
          }
          if (!cursor || key > cursor)
            objects.push({ key, modifiedAt: (await stat(path(key))).mtime });
        }
      }
      objects.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
      const page = objects.slice(0, 100);
      return { objects: page, cursor: objects.length > 100 ? page.at(-1)!.key : undefined };
    },
  };
}

export function createSpacesStorage(
  config = spacesConfiguration(),
  client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: config.credentials,
    maxAttempts: 3,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    requestHandler: {
      connectionTimeout: 5_000,
      requestTimeout: 30_000,
      socketTimeout: 30_000,
      throwOnRequestTimeout: true,
    },
  }),
): FileStorage {
  const key = (value: string) => {
    assertStorageKey(value);
    return config.prefix + value;
  };
  const put = async (value: string, bytes: Buffer, contentType: string) => {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key(value),
        Body: bytes,
        ContentLength: bytes.length,
        ContentType: contentType,
        ACL: "private",
        CacheControl: "private, no-store",
      }),
    );
  };
  const remove = async (value: string) => {
    await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key(value) }));
  };
  return {
    put,
    async promote(source, destination, bytes, contentType) {
      // Upload the exact bytes scanned, rather than copying a mutable quarantine object.
      await put(destination, bytes, contentType);
      await remove(source);
    },
    async read(value) {
      const result = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: key(value) }),
      );
      if (!result.Body) throw new Error("Missing object body.");
      return Buffer.from(await result.Body.transformToByteArray());
    },
    delete: remove,
    async list(prefix, cursor) {
      const result = await client.send(
        new ListObjectsV2Command({
          Bucket: config.bucket,
          Prefix: config.prefix + prefix,
          MaxKeys: 100,
          ContinuationToken: cursor,
        }),
      );
      return {
        objects: (result.Contents ?? []).flatMap((object) => {
          if (!object.Key?.startsWith(config.prefix + prefix) || !object.LastModified) return [];
          const value = object.Key.slice(config.prefix.length);
          try {
            assertStorageKey(value);
          } catch {
            return [];
          }
          return [{ key: value, modifiedAt: object.LastModified }];
        }),
        cursor: result.IsTruncated ? result.NextContinuationToken : undefined,
      };
    },
  };
}

let cachedSpaces: { configuration: string; storage: FileStorage } | undefined;

export function getFileStorage(): FileStorage {
  const backend = process.env.FILE_STORAGE_BACKEND ?? "filesystem";
  if (backend === "spaces") {
    try {
      const config = spacesConfiguration();
      const configuration = JSON.stringify(config);
      if (cachedSpaces?.configuration !== configuration)
        cachedSpaces = { configuration, storage: createSpacesStorage(config) };
      return cachedSpaces.storage;
    } catch {
      throw new ApiError(503, "FILE_STORAGE_UNAVAILABLE", "File storage is not configured.");
    }
  }
  if (backend !== "filesystem" || !allowsLocalFileScanner())
    throw new ApiError(503, "FILE_STORAGE_UNAVAILABLE", "Durable file storage is not configured.");
  return createFilesystemStorage(
    process.env.FILE_STORAGE_ROOT
      ? resolve(process.env.FILE_STORAGE_ROOT)
      : resolve(/* turbopackIgnore: true */ process.cwd(), "../../.data/uploads"),
  );
}
