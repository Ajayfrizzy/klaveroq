import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import postgres from "postgres";

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://klaveroq_test:klaveroq_test@127.0.0.1:55434/klaveroq_test";
const parsed = new URL(testDatabaseUrl);
const loopback = ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname);
const testNamed = parsed.pathname.toLowerCase().includes("test");

if (!loopback || !testNamed) {
  throw new Error(
    `Refusing to reset a non-disposable database: ${parsed.hostname}${parsed.pathname}`,
  );
}

const sql = postgres(testDatabaseUrl, { max: 1 });
await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE");
await sql.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE");
await sql.unsafe("CREATE SCHEMA public");
await sql.end();

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = spawnSync("npm", ["run", "db:migrate"], {
  cwd: repositoryRoot,
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  stdio: "inherit",
});
if (migration.status !== 0) process.exit(migration.status ?? 1);
