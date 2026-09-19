import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://klaveroq:klaveroq_local@127.0.0.1:5433/klaveroq";

const globalDatabase = globalThis as typeof globalThis & {
  klaveroqSql?: ReturnType<typeof postgres>;
};
const client =
  globalDatabase.klaveroqSql ??
  postgres(databaseUrl, { max: process.env.NODE_ENV === "production" ? 10 : 3, prepare: false });

if (process.env.NODE_ENV !== "production") globalDatabase.klaveroqSql = client;

export const db = drizzle(client, { schema });
export const sqlClient = client;
export { schema };
