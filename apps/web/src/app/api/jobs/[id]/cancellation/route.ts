import { and, desc, eq, inArray, sum } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { jobs, milestones, operations } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { requireJobParticipant } from "@/features/jobs/server/access";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { audit } from "@/server/audit";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("REQUEST"), reason: z.string().trim().min(10).max(2000) }),
  z.object({ action: z.enum(["ACCEPT", "DECLINE"]) }),
]);

export const POST = withApi(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    assertSameOrigin(request);
    const { user } = await requireUser();
    const { id } = await context.params;
    const { job } = await requireJobParticipant(id, user.id);
    const input = schema.parse(await request.json());
    if (input.action === "REQUEST") {
      if (["INVITED", "AWAITING_FUNDING"].includes(job.status) && job.clientUserId === user.id) {
        const [cancelled] = await db
          .update(jobs)
          .set({ status: "CANCELLED", updatedAt: new Date() })
          .where(and(eq(jobs.id, id), inArray(jobs.status, ["INVITED", "AWAITING_FUNDING"])))
          .returning({ id: jobs.id });
        if (!cancelled)
          throw new ApiError(
            409,
            "CANCELLATION_NOT_ALLOWED",
            "The agreement state already changed.",
          );
        await audit(request, {
          actorUserId: user.id,
          action: "job.cancelled_before_funding",
          entityType: "job",
          entityId: id,
          metadata: { previousStatus: job.status },
        });
        return Response.json({ data: { jobId: id, status: "CANCELLED" } });
      }
      if (job.status === "FUNDED_AWAITING_ACCEPTANCE" && job.clientUserId === user.id) {
        await db.transaction(async (tx) => {
          const [claimed] = await tx
            .update(jobs)
            .set({ status: "REFUND_PENDING", updatedAt: new Date() })
            .where(and(eq(jobs.id, id), eq(jobs.status, "FUNDED_AWAITING_ACCEPTANCE")))
            .returning({ id: jobs.id });
          if (!claimed)
            throw new ApiError(
              409,
              "CANCELLATION_NOT_ALLOWED",
              "The agreement state already changed.",
            );
          await tx
            .insert(operations)
            .values({
              jobId: id,
              initiatedBy: user.id,
              type: "REFUND",
              idempotencyKey: `preaccept-refund:${id}`,
              amount: job.subtotal + job.clientFee + job.networkReserve,
              asset: job.asset,
              metadata: { reason: input.reason },
            })
            .onConflictDoNothing();
        });
        await audit(request, {
          actorUserId: user.id,
          action: "job.preaccept_refund_requested",
          entityType: "job",
          entityId: id,
          metadata: { status: "REFUND_PENDING" },
        });
        return Response.json({ data: { jobId: id, status: "REFUND_PENDING" } });
      }
      if (job.status !== "IN_PROGRESS")
        throw new ApiError(
          409,
          "CANCELLATION_NOT_ALLOWED",
          "Cancellation cannot be requested in this state.",
        );
      await db.transaction(async (tx) => {
        const [claimed] = await tx
          .update(jobs)
          .set({ status: "CANCELLATION_PENDING", updatedAt: new Date() })
          .where(and(eq(jobs.id, id), eq(jobs.status, "IN_PROGRESS")))
          .returning({ id: jobs.id });
        if (!claimed)
          throw new ApiError(
            409,
            "CANCELLATION_NOT_ALLOWED",
            "The agreement state already changed.",
          );
        await tx.insert(operations).values({
          jobId: id,
          initiatedBy: user.id,
          type: "CANCELLATION_REQUEST",
          idempotencyKey: `cancellation:${id}:${Date.now()}`,
          status: "PENDING",
          metadata: { requestedBy: user.id, reason: input.reason },
        });
      });
      await audit(request, {
        actorUserId: user.id,
        action: "job.cancellation_requested",
        entityType: "job",
        entityId: id,
        metadata: { status: "CANCELLATION_PENDING" },
      });
      return Response.json({ data: { jobId: id, status: "CANCELLATION_PENDING" } });
    }
    if (job.status !== "CANCELLATION_PENDING")
      throw new ApiError(409, "CANCELLATION_NOT_PENDING", "No cancellation request is pending.");
    const [pending] = await db
      .select()
      .from(operations)
      .where(and(eq(operations.jobId, id), eq(operations.type, "CANCELLATION_REQUEST")))
      .orderBy(desc(operations.createdAt))
      .limit(1);
    const metadata = pending?.metadata as { requestedBy?: string } | null;
    if (!pending || metadata?.requestedBy === user.id)
      throw new ApiError(403, "COUNTERPARTY_REQUIRED", "The other party must decide this request.");
    if (input.action === "DECLINE") {
      await db.transaction(async (tx) => {
        const [claimed] = await tx
          .update(jobs)
          .set({ status: "IN_PROGRESS", updatedAt: new Date() })
          .where(and(eq(jobs.id, id), eq(jobs.status, "CANCELLATION_PENDING")))
          .returning({ id: jobs.id });
        if (!claimed)
          throw new ApiError(
            409,
            "CANCELLATION_NOT_PENDING",
            "The cancellation was already decided.",
          );
        await tx
          .update(operations)
          .set({ status: "CANCELLED", updatedAt: new Date() })
          .where(eq(operations.id, pending.id));
      });
      await audit(request, {
        actorUserId: user.id,
        action: "job.cancellation_declined",
        entityType: "job",
        entityId: id,
        metadata: { requestId: pending.id },
      });
      return Response.json({ data: { jobId: id, status: "IN_PROGRESS" } });
    }
    const refundableStatuses = ["PENDING", "ACTIVE", "REVISION_REQUESTED"] as const;
    const [calculation] = await db
      .select({ amount: sum(milestones.amount) })
      .from(milestones)
      .where(and(eq(milestones.jobId, id), inArray(milestones.status, refundableStatuses)));
    const refundAmount = BigInt(calculation.amount ?? "0");
    await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(jobs)
        .set({ status: "REFUND_PENDING", updatedAt: new Date() })
        .where(and(eq(jobs.id, id), eq(jobs.status, "CANCELLATION_PENDING")))
        .returning({ id: jobs.id });
      if (!claimed)
        throw new ApiError(
          409,
          "CANCELLATION_NOT_PENDING",
          "The cancellation was already decided.",
        );
      await tx
        .update(milestones)
        .set({ status: "CANCELLED", updatedAt: new Date() })
        .where(and(eq(milestones.jobId, id), inArray(milestones.status, refundableStatuses)));
      await tx
        .update(operations)
        .set({ status: "CONFIRMED", updatedAt: new Date() })
        .where(eq(operations.id, pending.id));
      await tx
        .insert(operations)
        .values({
          jobId: id,
          initiatedBy: user.id,
          type: "REFUND",
          idempotencyKey: `mutual-refund:${id}`,
          amount: refundAmount,
          asset: job.asset,
          status: "PENDING",
          metadata: { cancellationRequestId: pending.id, policy: "unreleased-milestone-principal" },
        })
        .onConflictDoNothing();
    });
    await audit(request, {
      actorUserId: user.id,
      action: "job.cancellation_accepted",
      entityType: "job",
      entityId: id,
      metadata: { requestId: pending.id, refundStatus: "PENDING" },
    });
    return Response.json({ data: { jobId: id, status: "REFUND_PENDING" } });
  },
);
