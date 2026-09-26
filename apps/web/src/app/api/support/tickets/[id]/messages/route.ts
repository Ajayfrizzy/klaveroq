import { and, count, eq, gt } from "drizzle-orm";
import { db } from "@/server/db";
import {
  operations,
  supportMessages,
  supportTicketEvents,
  supportTickets,
} from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { requireOwnedTicket } from "@/features/support/server/access";
import { createMessageSchema } from "@/features/support/server/schemas";
import { serialize } from "@/server/serialize";
import { notifyUser } from "@/server/notifications/service";
import { audit } from "@/server/audit";
import { requireIdempotencyKey, scopedIdempotencyKey } from "@/server/http/idempotency";

export const POST = withApi(
  async (request: Request, context: RouteContext<"/api/support/tickets/[id]/messages">) => {
    assertSameOrigin(request);
    const { user } = await requireUser();
    const { id } = await context.params;
    const ticket = await requireOwnedTicket(id, user.id);
    const idempotencyKey = scopedIdempotencyKey(
      "support-user-message",
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
    const input = createMessageSchema.parse(await request.json());
    if (ticket.status === "CLOSED")
      throw new ApiError(
        409,
        "SUPPORT_TICKET_CLOSED",
        "Closed tickets cannot receive new replies.",
      );
    const [recent] = await db
      .select({ value: count() })
      .from(supportMessages)
      .where(
        and(
          eq(supportMessages.senderId, user.id),
          gt(supportMessages.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
        ),
      );
    if (recent.value >= 30)
      throw new ApiError(
        429,
        "SUPPORT_RATE_LIMITED",
        "You can send up to 30 support replies per hour.",
      );
    const [message] = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(supportMessages)
        .values({ ticketId: id, senderId: user.id, senderType: "USER", message: input.message })
        .returning();
      await tx
        .update(supportTickets)
        .set({ status: "OPEN", lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(supportTickets.id, id));
      await tx
        .insert(supportTicketEvents)
        .values({ ticketId: id, actorUserId: user.id, type: "USER_REPLIED" });
      await tx.insert(operations).values({
        initiatedBy: user.id,
        type: "SUPPORT_USER_MESSAGE",
        idempotencyKey,
        status: "CONFIRMED",
        metadata: { messageId: created.id, ticketId: id },
      });
      return [created];
    });
    if (ticket.assignedTo)
      await notifyUser({
        userId: ticket.assignedTo,
        type: "SUPPORT_USER_REPLIED",
        category: "SUPPORT",
        title: `${ticket.reference}: customer replied`,
        body: input.message.slice(0, 180),
        href: `/admin/support/${id}`,
        dedupeKey: `support-user-reply:${message.id}`,
      });
    await audit(request, {
      actorUserId: user.id,
      action: "support.message_sent",
      entityType: "support_message",
      entityId: message.id,
      metadata: { ticketId: id },
    });
    return Response.json({ data: serialize(message) }, { status: 201 });
  },
);
