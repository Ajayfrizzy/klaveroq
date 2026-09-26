import { eq } from "drizzle-orm";
import { audit } from "@/server/audit";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { supportTicketEvents, supportTickets } from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { notifyUser } from "@/server/notifications/service";
import { requireOwnedTicket } from "@/features/support/server/access";

export const POST = withApi(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    assertSameOrigin(request);
    const { user } = await requireUser();
    const { id } = await context.params;
    const ticket = await requireOwnedTicket(id, user.id);
    if (!["RESOLVED", "CLOSED"].includes(ticket.status))
      throw new ApiError(
        409,
        "SUPPORT_REOPEN_INVALID",
        "Only resolved or closed cases can be reopened.",
      );
    const now = new Date();
    const [updated] = await db.transaction(async (tx) => {
      const [record] = await tx
        .update(supportTickets)
        .set({
          status: "OPEN",
          resolvedAt: null,
          closedAt: null,
          updatedAt: now,
          lastMessageAt: now,
        })
        .where(eq(supportTickets.id, id))
        .returning();
      await tx.insert(supportTicketEvents).values({
        ticketId: id,
        actorUserId: user.id,
        type: "REOPENED_BY_USER",
      });
      return [record];
    });
    if (ticket.assignedTo)
      await notifyUser({
        userId: ticket.assignedTo,
        type: "SUPPORT_TICKET_REOPENED",
        category: "SUPPORT",
        title: `${ticket.reference} was reopened`,
        body: ticket.subject,
        href: `/admin/support/${id}`,
        dedupeKey: `support-reopened:${id}:${now.toISOString()}`,
      });
    await audit(request, {
      actorUserId: user.id,
      action: "support.ticket.reopened",
      entityType: "support_ticket",
      entityId: id,
    });
    return Response.json({ data: { id: updated.id, status: updated.status } });
  },
);
