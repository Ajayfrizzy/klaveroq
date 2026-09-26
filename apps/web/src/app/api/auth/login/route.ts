import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { notifications, users } from "@/server/db/schema";
import { verifyPassword } from "@/server/auth/password";
import { loginSchema } from "@/server/auth/schemas";
import { createSession } from "@/server/auth/session";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { audit } from "@/server/audit";
import { enforceAuthRateLimit } from "@/server/auth/rate-limit";
import { activeMfaMethod, issueMfaLoginChallenge } from "@/server/auth/mfa";
import { safeReturnTo } from "@/server/auth/google";

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const input = loginSchema.parse(await request.json());
  await enforceAuthRateLimit({
    action: "login",
    limit: 30,
    request,
    windowMs: 15 * 60_000,
  });
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${input.email}`)
    .limit(1);
  const valid = user?.passwordHash
    ? await verifyPassword(user.passwordHash, input.password)
    : false;
  if (!user || !valid) {
    if (user)
      await db
        .update(users)
        .set({
          failedLoginCount: sql`${users.failedLoginCount} + 1`,
          lockedUntil:
            user.failedLoginCount >= 4 ? new Date(Date.now() + 15 * 60_000) : user.lockedUntil,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    throw new ApiError(401, "INVALID_CREDENTIALS", "The email or password is incorrect.");
  }
  if (user.lockedUntil && user.lockedUntil > new Date())
    throw new ApiError(
      423,
      "ACCOUNT_TEMPORARILY_LOCKED",
      "Try again after the account lock expires.",
    );
  if (["SUSPENDED", "CLOSED"].includes(user.status))
    throw new ApiError(403, "ACCOUNT_UNAVAILABLE", "This account cannot sign in.");
  if (await activeMfaMethod(user.id)) {
    await db
      .update(users)
      .set({ failedLoginCount: 0, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    const mfaToken = await issueMfaLoginChallenge(user.id, safeReturnTo(input.returnTo));
    return Response.json({ data: { mfaRequired: true, mfaToken } }, { status: 202 });
  }
  await db
    .update(users)
    .set({ failedLoginCount: 0, lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));
  await createSession(user.id, request);
  await db.insert(notifications).values({
    userId: user.id,
    type: "SECURITY_NEW_SESSION",
    title: "New sign-in",
    body: `A new session signed in${request.headers.get("user-agent") ? ` using ${request.headers.get("user-agent")}` : ""}.`,
    href: "/wallet",
  });
  await audit(request, {
    actorUserId: user.id,
    action: "session.created",
    entityType: "user",
    entityId: user.id,
  });
  return Response.json({
    data: {
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        systemRole: user.systemRole,
        emailVerified: Boolean(user.emailVerifiedAt),
      },
    },
  });
});
