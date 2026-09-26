import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { notifications, sessions, users, verificationTokens } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";
import { resetPasswordSchema } from "@/server/auth/schemas";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin, sha256 } from "@/server/http/security";
import { audit } from "@/server/audit";
import { enforceAuthRateLimit } from "@/server/auth/rate-limit";

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const input = resetPasswordSchema.parse(await request.json());
  await enforceAuthRateLimit({
    action: "password_reset_complete",
    limit: 10,
    request,
    windowMs: 60 * 60_000,
  });
  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  const userId = await db.transaction(async (tx) => {
    const [consumed] = await tx
      .update(verificationTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(verificationTokens.tokenHash, sha256(input.token)),
          eq(verificationTokens.purpose, "RESET_PASSWORD"),
          isNull(verificationTokens.consumedAt),
          gt(verificationTokens.expiresAt, now),
        ),
      )
      .returning({ userId: verificationTokens.userId });
    if (!consumed)
      throw new ApiError(
        400,
        "RESET_TOKEN_INVALID",
        "The password reset link is invalid or expired.",
      );
    await tx
      .update(users)
      .set({ passwordHash, failedLoginCount: 0, lockedUntil: null, updatedAt: now })
      .where(eq(users.id, consumed.userId));
    await tx.update(sessions).set({ revokedAt: now }).where(eq(sessions.userId, consumed.userId));
    await tx.insert(notifications).values({
      userId: consumed.userId,
      type: "SECURITY_PASSWORD_CHANGED",
      title: "Password changed",
      body: "Your password was changed and all signed-in sessions were revoked.",
      href: "/wallet",
    });
    return consumed.userId;
  });
  await audit(request, {
    actorUserId: userId,
    action: "account.password_reset_completed",
    entityType: "user",
    entityId: userId,
  });
  return Response.json({ data: { reset: true } });
});
