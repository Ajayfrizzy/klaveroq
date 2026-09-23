import { and, count, desc, eq, gte, inArray, lt, or } from "drizzle-orm";
import { confirmedFinancialSummary, utcMonthRange } from "@/features/dashboard/server/metrics";
import { db } from "@/server/db";
import { jobs, operations } from "@/server/db/schema";

const financialTypes = ["FUND", "MILESTONE_RELEASE", "RELEASE", "REFUND"];

const participant = (userId: string) =>
  or(eq(jobs.clientUserId, userId), eq(jobs.workerUserId, userId))!;

export async function getUserFinancialSummary(userId: string, now = new Date()) {
  const { start, end } = utcMonthRange(now);
  const base = [
    participant(userId),
    eq(operations.status, "CONFIRMED"),
    inArray(operations.type, financialTypes),
  ];
  const [funding, releases] = await Promise.all([
    db
      .select({ operation: operations, assetDecimals: jobs.assetDecimals, jobAsset: jobs.asset })
      .from(operations)
      .innerJoin(jobs, eq(operations.jobId, jobs.id))
      .where(and(...base, eq(operations.type, "FUND")))
      .orderBy(operations.createdAt, operations.id),
    db
      .select({ operation: operations, assetDecimals: jobs.assetDecimals, jobAsset: jobs.asset })
      .from(operations)
      .innerJoin(jobs, eq(operations.jobId, jobs.id))
      .where(
        and(
          ...base,
          inArray(operations.type, ["MILESTONE_RELEASE", "RELEASE"]),
          gte(operations.createdAt, start),
          lt(operations.createdAt, end),
        ),
      )
      .orderBy(operations.createdAt, operations.id),
  ]);
  return confirmedFinancialSummary(
    [...funding, ...releases].map(({ operation, assetDecimals, jobAsset }) => ({
      ...operation,
      asset: operation.asset ?? jobAsset,
      assetDecimals,
    })),
    now,
  );
}

export async function getPaymentHistory(userId: string, page: number, pageSize = 50) {
  const where = and(participant(userId), inArray(operations.type, financialTypes));
  const [records, totals] = await Promise.all([
    db
      .select({ operation: operations, job: jobs })
      .from(operations)
      .innerJoin(jobs, eq(operations.jobId, jobs.id))
      .where(where)
      .orderBy(desc(operations.createdAt), desc(operations.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ value: count(operations.id) })
      .from(operations)
      .innerJoin(jobs, eq(operations.jobId, jobs.id))
      .where(where),
  ]);
  return { records, total: totals[0]?.value ?? 0, pageSize };
}
