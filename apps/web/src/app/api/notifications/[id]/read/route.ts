import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { audit } from "@/server/audit";

const schema = z.object({ read: z.boolean().default(true) });

export const POST = withApi(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    assertSameOrigin(request);
    const { user } = await requireUser();
    const { id } = await context.params;
    const input = schema.parse(await request.json().catch(() => ({})));
    const [record] = await db
      .update(notifications)
      .set({ readAt: input.read ? new Date() : null })
      .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
      .returning({ id: notifications.id, readAt: notifications.readAt });
    if (!record) throw new ApiError(404, "NOTIFICATION_NOT_FOUND", "Notification was not found.");
    await audit(request, {
      actorUserId: user.id,
      action: input.read ? "notification.read" : "notification.unread",
      entityType: "notification",
      entityId: record.id,
    });
    return Response.json({ data: record });
  },
);
