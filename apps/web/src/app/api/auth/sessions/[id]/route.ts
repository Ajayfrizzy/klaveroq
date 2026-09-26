import { and, eq, gt, isNull } from "drizzle-orm";
import { audit } from "@/server/audit";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { notifications, sessions } from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";

export const DELETE = withApi(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    assertSameOrigin(request);
    const current = await requireUser();
    const { id } = await context.params;
    if (id === current.sessionId)
      throw new ApiError(
        400,
        "CURRENT_SESSION_REVOKE_NOT_ALLOWED",
        "Use sign out to end your current session.",
      );
    const [revoked] = await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(sessions.id, id),
          eq(sessions.userId, current.user.id),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .returning({ id: sessions.id });
    if (!revoked) throw new ApiError(404, "SESSION_NOT_FOUND", "The active session was not found.");
    await Promise.all([
      db.insert(notifications).values({
        userId: current.user.id,
        type: "SECURITY_SESSION_REVOKED",
        title: "Session revoked",
        body: "A signed-in device was removed from your account.",
        href: "/wallet",
      }),
      audit(request, {
        actorUserId: current.user.id,
        action: "session.revoked",
        entityType: "session",
        entityId: revoked.id,
      }),
    ]);
    return new Response(null, { status: 204 });
  },
);
