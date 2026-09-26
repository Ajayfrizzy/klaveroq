import { and, eq, lt } from "drizzle-orm";
import { db } from "@/server/db";
import { jobs, milestones, operations, proofSubmissions, reviews } from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { audit } from "@/server/audit";

export const POST = withApi(async (request: Request) => {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    throw new ApiError(401, "CRON_UNAUTHORIZED", "A valid cron credential is required.");
  const expired = await db
    .select({ proof: proofSubmissions, milestone: milestones, job: jobs })
    .from(proofSubmissions)
    .innerJoin(milestones, eq(milestones.id, proofSubmissions.milestoneId))
    .innerJoin(jobs, eq(jobs.id, milestones.jobId))
    .where(
      and(eq(milestones.status, "UNDER_REVIEW"), lt(proofSubmissions.reviewDeadline, new Date())),
    );
  let processed = 0;
  const processedMilestones: string[] = [];
  for (const row of expired)
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(milestones)
        .set({ status: "RELEASE_PENDING", updatedAt: new Date() })
        .where(and(eq(milestones.id, row.milestone.id), eq(milestones.status, "UNDER_REVIEW")))
        .returning({ id: milestones.id });
      if (!updated.length) return;
      await tx.insert(reviews).values({
        milestoneId: row.milestone.id,
        proofSubmissionId: row.proof.id,
        reviewerUserId: row.job.clientUserId,
        decision: "APPROVE",
        reason: "Automatically approved after the review window expired.",
        automatic: true,
      });
      await tx
        .insert(operations)
        .values({
          jobId: row.job.id,
          milestoneId: row.milestone.id,
          type: "MILESTONE_RELEASE",
          idempotencyKey: `auto-release:${row.milestone.id}:${row.proof.version}`,
          amount: row.milestone.amount,
          asset: row.job.asset,
          metadata: { automatic: true },
        })
        .onConflictDoNothing();
      processed++;
      processedMilestones.push(row.milestone.id);
    });
  for (const milestoneId of processedMilestones)
    await audit(request, {
      action: "internal.milestone_auto_approved",
      entityType: "milestone",
      entityId: milestoneId,
    });
  return Response.json({ data: { processed } });
});
