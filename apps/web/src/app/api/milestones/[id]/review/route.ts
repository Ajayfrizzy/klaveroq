import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import {
  milestones,
  operations,
  proofSubmissions,
  reviews,
  revisionRequests,
} from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { requireMilestoneParticipant } from "@/features/jobs/server/access";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { audit } from "@/server/audit";

const schema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVE"), reason: z.string().max(2000).optional() }),
  z.object({
    decision: z.literal("REQUEST_REVISION"),
    reason: z.string().trim().min(10).max(2000),
  }),
]);

export const POST = withApi(
  async (request: Request, context: RouteContext<"/api/milestones/[id]/review">) => {
    assertSameOrigin(request);
    const { user } = await requireUser();
    const { id } = await context.params;
    const { milestone, job, role } = await requireMilestoneParticipant(id, user.id);
    if (role !== "CLIENT")
      throw new ApiError(403, "CLIENT_ONLY", "Only the client can review proof.");
    if (milestone.status !== "UNDER_REVIEW")
      throw new ApiError(409, "MILESTONE_STATE_INVALID", "This milestone is not under review.");
    const input = schema.parse(await request.json());
    const [proof] = await db
      .select()
      .from(proofSubmissions)
      .where(eq(proofSubmissions.milestoneId, id))
      .orderBy(desc(proofSubmissions.version))
      .limit(1);
    if (!proof) throw new ApiError(409, "PROOF_REQUIRED", "No proof is available to review.");
    if (input.decision === "REQUEST_REVISION" && milestone.revisionCount >= 2)
      throw new ApiError(
        409,
        "REVISION_LIMIT_REACHED",
        "Two revision rounds have already been used. Approve the work or open a dispute.",
      );
    await db.transaction(async (tx) => {
      const nextStatus =
        input.decision === "REQUEST_REVISION" ? "REVISION_REQUESTED" : "RELEASE_PENDING";
      const [claimed] = await tx
        .update(milestones)
        .set({
          status: nextStatus,
          revisionCount:
            input.decision === "REQUEST_REVISION"
              ? milestone.revisionCount + 1
              : milestone.revisionCount,
          updatedAt: new Date(),
        })
        .where(and(eq(milestones.id, id), eq(milestones.status, "UNDER_REVIEW")))
        .returning({ id: milestones.id });
      if (!claimed)
        throw new ApiError(
          409,
          "MILESTONE_STATE_INVALID",
          "Another review already changed this milestone.",
        );
      await tx.insert(reviews).values({
        milestoneId: id,
        proofSubmissionId: proof.id,
        reviewerUserId: user.id,
        decision: input.decision,
        reason: input.reason,
      });
      if (input.decision === "REQUEST_REVISION") {
        await tx.insert(revisionRequests).values({
          milestoneId: id,
          proofSubmissionId: proof.id,
          requestedBy: user.id,
          reason: input.reason,
          responseDueAt: new Date(Date.now() + 3 * 86_400_000),
        });
      } else {
        await tx.insert(operations).values({
          jobId: job.id,
          milestoneId: id,
          initiatedBy: user.id,
          type: "MILESTONE_RELEASE",
          idempotencyKey: `release:${id}:${proof.version}`,
          amount: milestone.amount,
          asset: job.asset,
          status: "PENDING",
          metadata: { proofId: proof.id },
        });
      }
    });
    await audit(request, {
      actorUserId: user.id,
      action:
        input.decision === "APPROVE" ? "milestone.proof_approved" : "milestone.revision_requested",
      entityType: "milestone",
      entityId: id,
      metadata: { jobId: job.id, proofId: proof.id, decision: input.decision },
    });
    return Response.json({
      data: {
        milestoneId: id,
        status: input.decision === "APPROVE" ? "RELEASE_PENDING" : "REVISION_REQUESTED",
      },
    });
  },
);
