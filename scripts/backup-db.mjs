import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";

const databaseUrl = process.env.DATABASE_URL;
const destination = process.argv[2];
if (!databaseUrl || !destination) {
  console.error("Usage: DATABASE_URL=... node scripts/backup-db.mjs <destination.dump>");
  process.exit(2);
}
const output = resolve(destination);
await mkdir(dirname(output), { recursive: true });
const child = spawn(
  "pg_dump",
  ["--format=custom", "--no-owner", "--no-acl", "--file", output, databaseUrl],
  {
    stdio: "inherit",
  },
);
const code = await new Promise((resolveCode) => child.on("close", resolveCode));
if (code !== 0) process.exit(code ?? 1);
console.log(`Backup written to ${output}`);
