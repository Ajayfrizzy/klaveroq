import type { FileStorage } from "./backend";

// Upload/scanning requests have bounded timeouts. Never collect recent/in-flight objects.
export const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

export async function cleanupFilePage({
  storage,
  isReferenced,
  prefix,
  cursor,
  dryRun = true,
  now = new Date(),
}: {
  storage: FileStorage;
  isReferenced: (key: string) => Promise<boolean>;
  prefix: "clean/" | "quarantine/";
  cursor?: string;
  dryRun?: boolean;
  now?: Date;
}) {
  const page = await storage.list(prefix, cursor);
  let candidates = 0;
  let deleted = 0;
  for (const object of page.objects) {
    if (!(object.modifiedAt.getTime() < now.getTime() - ORPHAN_GRACE_MS)) continue;
    // A database error aborts cleanup. Never interpret an unavailable database as no references.
    if (await isReferenced(object.key)) continue;
    candidates++;
    if (!dryRun) {
      await storage.delete(object.key);
      deleted++;
    }
  }
  return { scanned: page.objects.length, candidates, deleted, cursor: page.cursor, dryRun };
}
