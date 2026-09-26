import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { disputeEvents, disputes, jobs, milestones } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { requireJobParticipant } from "@/features/jobs/server/access";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { serialize } from "@/server/serialize";
import { createDisputeReference } from "@/server/references";
import { notifyUser } from "@/server/notifications/service";
import { audit } from "@/server/audit";

const schema = z.object({
  milestoneId: z.string().uuid().optional(),
  reasonCode: z.enum([
    "WORK_NOT_DELIVERED",
    "WORK_NOT_AS_AGREED",
    "CLIENT_UNRESPONSIVE",
    "UNAUTHORIZED_CHANGE",
    "OTHER",
  ]),
  description: z.string().trim().min(30).max(5000),
});
export const GET = withApi(
  async (_request: Request, context: RouteContext<"/api/jobs/[id]/disputes">) => {
    const { user } = await requireUser();
    const { id } = await context.params;
    await requireJobParticipant(id, user.id);
    return Response.json({
      data: serialize(await db.select().from(disputes).where(eq(disputes.jobId, id))),
    });
  },
);
export const POST = withApi(
  async (request: Request, context: RouteContext<"/api/jobs/[id]/disputes">) => {
    assertSameOrigin(request);
    const { user } = await requireUser();
    const { id } = await context.params;
    const { job } = await requireJobParticipant(id, user.id);
    const input = schema.parse(await request.json());
    if (!["IN_PROGRESS", "COMPLETED", "CANCELLATION_PENDING"].includes(job.status))
      throw new ApiError(
        409,
        "DISPUTE_NOT_ELIGIBLE",
        "This job is not in a dispute-eligible state.",
      );
    if (input.milestoneId) {
      const [item] = await db
        .select()
        .from(milestones)
        .where(eq(milestones.id, input.milestoneId))
        .limit(1);
      if (!item || item.jobId !== id || ["RELEASED", "REFUNDED", "CANCELLED"].includes(item.status))
        throw new ApiError(
          400,
          "MILESTONE_NOT_ELIGIBLE",
          "The selected milestone is not eligible for dispute.",
        );
    }
    const [record] = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(jobs)
        .set({ status: "DISPUTED", updatedAt: new Date() })
        .where(
          and(
            eq(jobs.id, id),
            inArray(jobs.status, ["IN_PROGRESS", "COMPLETED", "CANCELLATION_PENDING"]),
          ),
        )
        .returning({ id: jobs.id });
      if (!claimed)
        throw new ApiError(409, "DISPUTE_ALREADY_OPEN", "A dispute is already open for this job.");
      const [created] = await tx
        .insert(disputes)
        .values({
          reference: createDisputeReference(),
          jobId: id,
          milestoneId: input.milestoneId,
          openedBy: user.id,
          reasonCode: input.reasonCode,
          description: input.description,
          status: "EVIDENCE_COLLECTION",
          evidenceDueAt: new Date(Date.now() + 3 * 86_400_000),
        })
        .returning();
      await tx.insert(disputeEvents).values({
        disputeId: created.id,
        actorUserId: user.id,
        type: "DISPUTE_OPENED",
        detail: "The dispute was opened and entered evidence collection.",
        metadata: { evidenceDueAt: created.evidenceDueAt.toISOString() },
      });
      if (input.milestoneId)
        await tx
          .update(milestones)
          .set({ status: "DISPUTED", updatedAt: new Date() })
          .where(eq(milestones.id, input.milestoneId));
      return [created];
    });
    const recipientUserId = user.id === job.clientUserId ? job.workerUserId : job.clientUserId;
    if (recipientUserId)
      await notifyUser({
        userId: recipientUserId,
        type: "DISPUTE_OPENED",
        category: "DISPUTE",
        title: `Dispute opened for ${job.reference}`,
        body: "A participant opened a dispute. Review the case and evidence deadline.",
        href: `/jobs/${id}`,
        dedupeKey: `dispute-opened:${record.id}:${recipientUserId}`,
      });
    await audit(request, {
      actorUserId: user.id,
      action: "dispute.opened",
      entityType: "dispute",
      entityId: record.id,
      metadata: { jobId: id, milestoneId: input.milestoneId ?? null, reasonCode: input.reasonCode },
    });
    return Response.json({ data: serialize(record) }, { status: 201 });
  },
);
