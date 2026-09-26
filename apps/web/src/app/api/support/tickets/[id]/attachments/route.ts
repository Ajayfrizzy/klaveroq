import { and, count, eq, sum } from "drizzle-orm";
import { db } from "@/server/db";
import { supportAttachments, supportMessages } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { isSupportAdmin, requireSupportTicket } from "@/features/support/server/access";
import { deletePrivateFile, storePrivateFile } from "@/server/files/storage";
import { serialize } from "@/server/serialize";
import { audit } from "@/server/audit";

export const POST = withApi(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    assertSameOrigin(request);
    const { user } = await requireUser();
    const { id } = await context.params;
    const ticket = await requireSupportTicket(id);
    if (ticket.userId !== user.id && !isSupportAdmin(user.systemRole))
      throw new ApiError(404, "SUPPORT_TICKET_NOT_FOUND", "Support ticket was not found.");
    if (ticket.status === "CLOSED")
      throw new ApiError(
        409,
        "SUPPORT_TICKET_CLOSED",
        "Reopen this case before adding attachments.",
      );
    const form = await request.formData();
    const file = form.get("file");
    const messageId = form.get("messageId");
    if (!(file instanceof File) || typeof messageId !== "string")
      throw new ApiError(400, "SUPPORT_ATTACHMENT_INVALID", "Provide a file and message ID.");
    const [message] = await db
      .select()
      .from(supportMessages)
      .where(and(eq(supportMessages.id, messageId), eq(supportMessages.ticketId, id)))
      .limit(1);
    if (!message || message.senderId !== user.id)
      throw new ApiError(
        403,
        "SUPPORT_ATTACHMENT_FORBIDDEN",
        "Attach files only to your own message.",
      );
    const [usage] = await db
      .select({ fileCount: count(), bytes: sum(supportAttachments.sizeBytes) })
      .from(supportAttachments)
      .innerJoin(supportMessages, eq(supportMessages.id, supportAttachments.messageId))
      .where(eq(supportMessages.ticketId, id));
    if (Number(usage.fileCount) >= 20 || Number(usage.bytes ?? 0) + file.size > 100 * 1024 * 1024)
      throw new ApiError(
        413,
        "SUPPORT_ATTACHMENT_LIMIT_EXCEEDED",
        "A support case may contain at most 20 files and 100 MB total.",
      );
    const stored = await storePrivateFile(file);
    let attachment;
    try {
      [attachment] = await db
        .insert(supportAttachments)
        .values({ messageId, ...stored, originalName: file.name.slice(0, 255) })
        .returning();
    } catch (error) {
      await deletePrivateFile(stored.storageKey);
      throw error;
    }
    await audit(request, {
      actorUserId: user.id,
      action: "support.attachment_uploaded",
      entityType: "support_attachment",
      entityId: attachment.id,
      metadata: { ticketId: id, sizeBytes: attachment.sizeBytes },
    });
    return Response.json({ data: serialize(attachment) }, { status: 201 });
  },
);
