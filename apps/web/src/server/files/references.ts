import { sql } from "drizzle-orm";
import { db } from "../db";

export async function isFileReferenced(key: string) {
  // Include both metadata and profile pointers, so partial legacy records are preserved.
  const [row] = await db.execute<{ referenced: boolean }>(sql`
    select exists (
      select 1 from media_files where storage_key = ${key}
      union all select 1 from proof_files where storage_key = ${key}
      union all select 1 from dispute_files where storage_key = ${key}
      union all select 1 from support_attachments where storage_key = ${key}
      union all select 1 from profiles where avatar_key = ${key}
      union all select 1 from portfolio_items where media_key = ${key}
    ) as referenced
  `);
  if (typeof row?.referenced !== "boolean") throw new Error("File reference check failed.");
  return row.referenced;
}
