import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { supportTicketEvents, supportTickets, users } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { requireRole } from "@/server/auth/authorization";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { requireSupportTicket } from "@/features/support/server/access";
import { ticketDetail } from "@/features/support/server/queries";
import { updateTicketSchema } from "@/features/support/server/schemas";
import { serialize } from "@/server/serialize";
import { audit } from "@/server/audit";
import { notifyUser } from "@/server/notifications/service";

const statusTransitions: Record<string, string[]> = {
  OPEN: ["IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["OPEN", "WAITING_FOR_USER", "RESOLVED", "CLOSED"],
  WAITING_FOR_USER: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
  RESOLVED: ["OPEN", "CLOSED"],
  CLOSED: ["OPEN"],
};

export const GET = withApi(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const { user } = await requireUser();
    requireRole(user.systemRole, ["SUPPORT", "SUPER_ADMIN"]);
    const { id } = await context.params;
    await requireSupportTicket(id);
    return Response.json({ data: serialize(await ticketDetail(id, true)) });
  },
);

export const PATCH = withApi(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    assertSameOrigin(request);
    const { user } = await requireUser();
    requireRole(user.systemRole, ["SUPPORT", "SUPER_ADMIN"]);
    const { id } = await context.params;
    const ticket = await requireSupportTicket(id);
    const input = updateTicketSchema.parse(await request.json());
    if (
      input.status &&
      input.status !== ticket.status &&
      !statusTransitions[ticket.status]?.includes(input.status)
    )
      throw new ApiError(
        409,
        "SUPPORT_STATUS_TRANSITION_INVALID",
        `A ${ticket.status.toLowerCase().replaceAll("_", " ")} case cannot move directly to ${input.status.toLowerCase().replaceAll("_", " ")}.`,
      );
    if (input.assignedTo) {
      const [assignee] = await db
        .select()
        .from(users)
        .where(eq(users.id, input.assignedTo))
        .limit(1);
      if (!assignee || !["SUPPORT", "SUPER_ADMIN"].includes(assignee.systemRole))
        throw new ApiError(
          400,
          "SUPPORT_ASSIGNEE_INVALID",
          "Assign tickets only to a support administrator.",
        );
    }
    const now = new Date();
    const update = {
      ...input,
      updatedAt: now,
      resolvedAt: input.status === "RESOLVED" ? now : input.status ? null : ticket.resolvedAt,
      closedAt: input.status === "CLOSED" ? now : input.status ? null : ticket.closedAt,
    };
    const { updated, eventId } = await db.transaction(async (tx) => {
      const [record] = await tx
        .update(supportTickets)
        .set(update)
        .where(eq(supportTickets.id, id))
        .returning();
      const [event] = await tx
        .insert(supportTicketEvents)
        .values({ ticketId: id, actorUserId: user.id, type: "ADMIN_UPDATED", metadata: input })
        .returning({ id: supportTicketEvents.id });
      return { updated: record, eventId: event.id };
    });
    if (input.status && input.status !== ticket.status)
      await notifyUser({
        userId: ticket.userId,
        type: "SUPPORT_STATUS_CHANGED",
        category: "SUPPORT",
        title: `${ticket.reference} is now ${input.status.toLowerCase().replaceAll("_", " ")}`,
        body: ticket.subject,
        href: `/support/${id}`,
        dedupeKey: `support-status:${eventId}`,
      });
    if (input.assignedTo && input.assignedTo !== ticket.assignedTo)
      await notifyUser({
        userId: input.assignedTo,
        type: "SUPPORT_ASSIGNED",
        category: "SUPPORT",
        title: `${ticket.reference} was assigned to you`,
        body: ticket.subject,
        href: `/admin/support/${id}`,
        dedupeKey: `support-assigned:${eventId}:${input.assignedTo}`,
      });
    await audit(request, {
      actorUserId: user.id,
      action: "support.ticket.updated",
      entityType: "support_ticket",
      entityId: id,
      metadata: input,
    });
    return Response.json({ data: serialize(updated) });
  },
);
