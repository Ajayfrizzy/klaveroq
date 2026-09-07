import { and, eq, isNull } from "drizzle-orm";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";
import { withApi } from "@/server/http/errors";

export const GET = withApi(async () => {
  const { user } = await requireUser();
  const [unread] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)))
    .limit(1);

  return Response.json({ data: { hasUnread: Boolean(unread) } });
});
