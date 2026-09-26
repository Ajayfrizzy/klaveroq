import { spawn } from "node:child_process";
import { resolve } from "node:path";

const targetUrl = process.env.RESTORE_DATABASE_URL;
const source = process.argv[2];
if (!targetUrl || !source) {
  console.error("Usage: RESTORE_DATABASE_URL=... node scripts/restore-db.mjs <source.dump>");
  process.exit(2);
}
const databaseName = new URL(targetUrl).pathname.slice(1);
if (!databaseName.endsWith("_restore_test") && process.env.ALLOW_DATABASE_RESTORE !== "1") {
  console.error(
    "Refusing restore: target must end in _restore_test unless ALLOW_DATABASE_RESTORE=1.",
  );
  process.exit(2);
}
const child = spawn(
  "pg_restore",
  ["--clean", "--if-exists", "--no-owner", "--no-acl", "--dbname", targetUrl, resolve(source)],
  { stdio: "inherit" },
);
const code = await new Promise((resolveCode) => child.on("close", resolveCode));
if (code !== 0) process.exit(code ?? 1);
console.log(`Backup restored to ${databaseName}`);
