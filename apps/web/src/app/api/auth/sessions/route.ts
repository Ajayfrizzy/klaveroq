import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { sessions } from "@/server/db/schema";
import { withApi } from "@/server/http/errors";

export const GET = withApi(async () => {
  const current = await requireUser();
  const records = await db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, current.user.id),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(sessions.lastSeenAt));
  return Response.json({
    data: records.map((session) => ({
      ...session,
      current: session.id === current.sessionId,
    })),
  });
});
