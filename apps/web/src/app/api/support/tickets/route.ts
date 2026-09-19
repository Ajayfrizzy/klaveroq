import { and, count, desc, eq, gt } from "drizzle-orm";
import { db } from "@/server/db";
import {
  notifications,
  supportMessages,
  supportTicketEvents,
  supportTickets,
  users,
} from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { createTicketSchema } from "@/features/support/server/schemas";
import { serialize } from "@/server/serialize";
import { audit } from "@/server/audit";
import { validateOwnedReference } from "@/features/support/server/references";
import { createSupportReference } from "@/server/references";

export const GET = withApi(async () => {
  const { user } = await requireUser();
  const records = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, user.id))
    .orderBy(desc(supportTickets.lastMessageAt));
  return Response.json({ data: serialize(records) });
});

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  const input = createTicketSchema.parse(await request.json());
  const [recent] = await db
    .select({ value: count() })
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.userId, user.id),
        gt(supportTickets.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
      ),
    );
  if (recent.value >= 5)
    throw new ApiError(
      429,
      "SUPPORT_RATE_LIMITED",
      "You can create up to five support cases per hour.",
    );
  await validateOwnedReference(input.referenceId, user.id);
  const reference = createSupportReference();
  const ticket = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(supportTickets)
      .values({
        reference,
        userId: user.id,
        subject: input.subject,
        category: input.category,
        referenceId: input.referenceId,
      })
      .returning();
    await tx.insert(supportMessages).values({
      ticketId: created.id,
      senderId: user.id,
      senderType: "USER",
      message: input.message,
    });
    await tx.insert(supportTicketEvents).values({
      ticketId: created.id,
      actorUserId: user.id,
      type: "CREATED",
      metadata: { category: input.category },
    });
    const admins = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.systemRole, "SUPPORT"));
    if (admins.length)
      await tx.insert(notifications).values(
        admins.map((admin) => ({
          userId: admin.id,
          type: "SUPPORT_TICKET_CREATED",
          title: `New support case ${reference}`,
          body: input.subject,
          href: `/admin/support/${created.id}`,
        })),
      );
    return created;
  });
  await audit(request, {
    actorUserId: user.id,
    action: "support.ticket.created",
    entityType: "support_ticket",
    entityId: ticket.id,
    metadata: { reference },
  });
  return Response.json({ data: serialize(ticket) }, { status: 201 });
});
