import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireRole } from "@/server/auth/authorization";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import {
  disputeDecisions,
  disputeEvents,
  disputes,
  jobs,
  milestones,
  operations,
  users,
} from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { notifyUser } from "@/server/notifications/service";
import { audit } from "@/server/audit";

const schema = z
  .discriminatedUnion("action", [
    z.object({
      action: z.literal("PROPOSE"),
      workerShareBps: z.number().int().min(0).max(10000),
      clientRefundBps: z.number().int().min(0).max(10000),
      rationale: z.string().trim().min(30).max(5000),
      requiredApproverId: z.string().uuid(),
    }),
    z.object({ action: z.literal("APPROVE") }),
  ])
  .refine(
    (value) => value.action === "APPROVE" || value.workerShareBps + value.clientRefundBps === 10000,
    "The payment and refund shares must total 100%.",
  );

async function notifyParticipants(
  job: typeof jobs.$inferSelect,
  disputeId: string,
  reference: string,
) {
  for (const userId of [job.clientUserId, job.workerUserId].filter((value): value is string =>
    Boolean(value),
  ))
    await notifyUser({
      userId,
      type: "DISPUTE_DECIDED",
      category: "DISPUTE",
      title: `Decision recorded for ${reference}`,
      body: "The dispute decision is available. Any settlement remains pending PactAgent confirmation.",
      href: `/jobs/${job.id}`,
      dedupeKey: `dispute-decided:${disputeId}:${userId}`,
    });
}

export const POST = withApi(
  async (request: Request, context: RouteContext<"/api/admin/disputes/[id]/decision">) => {
    assertSameOrigin(request);
    const { user } = await requireUser();
    requireRole(user.systemRole, ["DISPUTE_ADMIN", "SUPER_ADMIN"]);
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const [record] = await db
      .select({ dispute: disputes, job: jobs })
      .from(disputes)
      .innerJoin(jobs, eq(jobs.id, disputes.jobId))
      .where(eq(disputes.id, id))
      .limit(1);
    if (!record) throw new ApiError(404, "DISPUTE_NOT_FOUND", "The dispute was not found.");

    if (input.action === "PROPOSE") {
      if (!["OPEN", "EVIDENCE_COLLECTION"].includes(record.dispute.status))
        throw new ApiError(409, "DISPUTE_STATE_INVALID", "The dispute cannot accept a decision.");
      if (input.requiredApproverId === user.id)
        throw new ApiError(
          400,
          "SECOND_APPROVER_INVALID",
          "The second approver must be a different administrator.",
        );
      const [approver] = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.id, input.requiredApproverId),
            inArray(users.systemRole, ["DISPUTE_ADMIN", "SUPER_ADMIN"]),
            eq(users.status, "ACTIVE"),
          ),
        )
        .limit(1);
      if (!approver)
        throw new ApiError(
          400,
          "SECOND_APPROVER_INVALID",
          "Select a dispute administrator as the second approver.",
        );
      const [decision] = await db.transaction(async (tx) => {
        const [claimed] = await tx
          .update(disputes)
          .set({ status: "UNDER_REVIEW", updatedAt: new Date() })
          .where(
            and(eq(disputes.id, id), inArray(disputes.status, ["OPEN", "EVIDENCE_COLLECTION"])),
          )
          .returning({ id: disputes.id });
        if (!claimed)
          throw new ApiError(
            409,
            "DISPUTE_STATE_INVALID",
            "Another administrator already submitted a decision.",
          );
        const created = await tx
          .insert(disputeDecisions)
          .values({
            disputeId: id,
            decidedBy: user.id,
            requiredApproverId: input.requiredApproverId,
            workerShareBps: input.workerShareBps,
            clientRefundBps: input.clientRefundBps,
            rationale: input.rationale,
          })
          .returning();
        await tx.insert(disputeEvents).values({
          disputeId: id,
          actorUserId: user.id,
          type: "DECISION_PROPOSED",
          detail: "A decision was proposed and sent for independent approval.",
          metadata: { decisionId: created[0].id, requiredApproverId: input.requiredApproverId },
        });
        return created;
      });
      await notifyUser({
        userId: input.requiredApproverId,
        type: "DISPUTE_APPROVAL_REQUIRED",
        category: "DISPUTE",
        title: `Approval required for ${record.dispute.reference}`,
        body: "An administrator proposed a dispute decision that requires your independent approval.",
        href: `/admin/disputes/${id}`,
        dedupeKey: `dispute-approval:${decision.id}:${input.requiredApproverId}`,
      });
      await audit(request, {
        actorUserId: user.id,
        action: "admin.dispute_decision_proposed",
        entityType: "dispute_decision",
        entityId: decision.id,
        metadata: { disputeId: id, requiredApproverId: input.requiredApproverId },
      });
      return Response.json({ data: { disputeId: id, status: "UNDER_REVIEW" } }, { status: 201 });
    }

    const [decision] = await db
      .select()
      .from(disputeDecisions)
      .where(eq(disputeDecisions.disputeId, id))
      .limit(1);
    if (!decision || decision.requiredApproverId !== user.id)
      throw new ApiError(
        403,
        "SECOND_APPROVER_REQUIRED",
        "You are not assigned to approve this decision.",
      );
    await db.transaction(async (tx) => {
      const [approved] = await tx
        .update(disputeDecisions)
        .set({ approvedBy: user.id, approvedAt: new Date() })
        .where(
          and(
            eq(disputeDecisions.id, decision.id),
            eq(disputeDecisions.requiredApproverId, user.id),
            isNull(disputeDecisions.approvedBy),
          ),
        )
        .returning({ id: disputeDecisions.id });
      if (!approved)
        throw new ApiError(409, "DECISION_ALREADY_APPROVED", "This decision was already approved.");
      const [resolved] = await tx
        .update(disputes)
        .set({ status: "RESOLVED", resolvedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(disputes.id, id), eq(disputes.status, "UNDER_REVIEW")))
        .returning({ id: disputes.id });
      if (!resolved)
        throw new ApiError(
          409,
          "DISPUTE_STATE_INVALID",
          "The dispute is no longer awaiting approval.",
        );
      await tx
        .update(jobs)
        .set({ status: "SECURITY_HOLD", updatedAt: new Date() })
        .where(and(eq(jobs.id, record.dispute.jobId), eq(jobs.status, "DISPUTED")));
      if (record.dispute.milestoneId)
        await tx
          .update(milestones)
          .set({ status: "SECURITY_HOLD", updatedAt: new Date() })
          .where(eq(milestones.id, record.dispute.milestoneId));
      await tx.insert(operations).values({
        jobId: record.dispute.jobId,
        milestoneId: record.dispute.milestoneId,
        initiatedBy: user.id,
        type: "DISPUTE_SETTLEMENT",
        idempotencyKey: `dispute-settlement:${id}`,
        status: "PENDING",
        metadata: {
          decisionId: decision.id,
          workerShareBps: decision.workerShareBps,
          clientRefundBps: decision.clientRefundBps,
          pactAgentConfirmationRequired: true,
        },
      });
      await tx.insert(disputeEvents).values({
        disputeId: id,
        actorUserId: user.id,
        type: "DECISION_APPROVED",
        detail: "The independent approver confirmed the decision. Settlement is pending PactAgent.",
        metadata: { decisionId: decision.id, settlementStatus: "PENDING" },
      });
    });
    await notifyParticipants(record.job, id, record.dispute.reference);
    await audit(request, {
      actorUserId: user.id,
      action: "admin.dispute_decision_approved",
      entityType: "dispute_decision",
      entityId: decision.id,
      metadata: { disputeId: id, settlementStatus: "PENDING" },
    });
    return Response.json({
      data: { disputeId: id, status: "RESOLVED", settlementStatus: "PENDING" },
    });
  },
);
