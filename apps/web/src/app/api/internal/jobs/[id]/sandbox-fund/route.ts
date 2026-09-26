import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { jobs, operations } from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { audit } from "@/server/audit";

export const POST = withApi(
  async (request: Request, context: RouteContext<"/api/internal/jobs/[id]/sandbox-fund">) => {
    if (
      process.env.NODE_ENV === "production" ||
      request.headers.get("x-sandbox-secret") !== process.env.SANDBOX_SECRET
    )
      throw new ApiError(404, "NOT_FOUND", "Route not found.");
    const { id } = await context.params;
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job || !["INVITED", "AWAITING_FUNDING"].includes(job.status))
      throw new ApiError(409, "JOB_STATE_INVALID", "The job is not awaiting sandbox funding.");
    await db.transaction(async (tx) => {
      await tx
        .update(jobs)
        .set({
          status: "FUNDED_AWAITING_ACCEPTANCE",
          fundedAt: new Date(),
          acceptanceExpiresAt: new Date(Date.now() + 7 * 86_400_000),
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, id));
      await tx
        .insert(operations)
        .values({
          jobId: id,
          type: "FUND",
          idempotencyKey: `sandbox-fund:${id}`,
          amount: job.subtotal + job.clientFee + job.networkReserve,
          asset: job.asset,
          status: "CONFIRMED",
          externalReference: `sandbox:${id}`,
        })
        .onConflictDoNothing();
    });
    await audit(request, {
      action: "internal.sandbox_funding_confirmed",
      entityType: "job",
      entityId: id,
      metadata: { environment: "sandbox" },
    });
    return Response.json({ data: { jobId: id, status: "FUNDED_AWAITING_ACCEPTANCE" } });
  },
);
