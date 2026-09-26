import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  operations,
  supportMessages,
  supportTicketEvents,
  supportTickets,
} from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { requireRole } from "@/server/auth/authorization";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { requireSupportTicket } from "@/features/support/server/access";
import { createMessageSchema } from "@/features/support/server/schemas";
import { serialize } from "@/server/serialize";
import { enforceAuthRateLimit } from "@/server/auth/rate-limit";
import { notifyUser } from "@/server/notifications/service";
import { audit } from "@/server/audit";
import { requireIdempotencyKey, scopedIdempotencyKey } from "@/server/http/idempotency";

export const POST = withApi(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    assertSameOrigin(request);
    const { user } = await requireUser();
    requireRole(user.systemRole, ["SUPPORT", "SUPER_ADMIN"]);
    const { id } = await context.params;
    const ticket = await requireSupportTicket(id);
    const idempotencyKey = scopedIdempotencyKey(
      "support-admin-message",
      user.id,
      requireIdempotencyKey(request),
    );
    const [prior] = await db
      .select()
      .from(operations)
      .where(eq(operations.idempotencyKey, idempotencyKey))
      .limit(1);
    const priorMessageId =
      prior?.metadata && typeof prior.metadata === "object" && "messageId" in prior.metadata
        ? String(prior.metadata.messageId)
        : null;
    if (priorMessageId) {
      const [existing] = await db
        .select()
        .from(supportMessages)
        .where(eq(supportMessages.id, priorMessageId))
        .limit(1);
      if (existing) return Response.json({ data: serialize(existing), idempotentReplay: true });
    }
    await enforceAuthRateLimit({
      action: "support-admin-message",
      limit: 60,
      request,
      subject: user.id,
      windowMs: 60 * 60 * 1000,
    });
    const input = createMessageSchema.parse(await request.json());
    if (ticket.status === "CLOSED")
      throw new ApiError(409, "SUPPORT_TICKET_CLOSED", "Reopen this ticket before replying.");
    const [message] = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(supportMessages)
        .values({
          ticketId: id,
          senderId: user.id,
          senderType: input.internal ? "SYSTEM" : "SUPPORT",
          message: input.message,
          internal: input.internal,
        })
        .returning();
      await tx
        .update(supportTickets)
        .set({
          status: input.internal ? ticket.status : "WAITING_FOR_USER",
          assignedTo: ticket.assignedTo ?? user.id,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(supportTickets.id, id));
      await tx.insert(supportTicketEvents).values({
        ticketId: id,
        actorUserId: user.id,
        type: input.internal ? "INTERNAL_NOTE_ADDED" : "SUPPORT_REPLIED",
      });
      await tx.insert(operations).values({
        initiatedBy: user.id,
        type: "SUPPORT_ADMIN_MESSAGE",
        idempotencyKey,
        status: "CONFIRMED",
        metadata: { messageId: created.id, ticketId: id },
      });
      return [created];
    });
    if (!input.internal)
      await notifyUser({
        userId: ticket.userId,
        type: "SUPPORT_REPLIED",
        category: "SUPPORT",
        title: `Support replied to ${ticket.reference}`,
        body: input.message.slice(0, 180),
        href: `/support/${id}`,
        dedupeKey: `support-reply:${message.id}`,
      });
    await audit(request, {
      actorUserId: user.id,
      action: input.internal ? "support.internal_note_added" : "support.reply_sent",
      entityType: "support_message",
      entityId: message.id,
      metadata: { ticketId: id },
    });
    return Response.json({ data: serialize(message) }, { status: 201 });
  },
);
