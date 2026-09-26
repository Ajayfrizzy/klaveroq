import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/server/audit";
import { verifyMfaCode } from "@/server/auth/mfa";
import { enforceAuthRateLimit } from "@/server/auth/rate-limit";
import { createSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { mfaLoginChallenges, mfaMethods, notifications, users } from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin, sha256 } from "@/server/http/security";

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { token, code } = z
    .object({ token: z.string().min(20), code: z.string().min(6).max(40) })
    .parse(await request.json());
  await enforceAuthRateLimit({
    action: "mfa_challenge",
    limit: 10,
    request,
    windowMs: 15 * 60_000,
  });
  const [record] = await db
    .select({ challenge: mfaLoginChallenges, method: mfaMethods, user: users })
    .from(mfaLoginChallenges)
    .innerJoin(users, eq(users.id, mfaLoginChallenges.userId))
    .innerJoin(mfaMethods, eq(mfaMethods.userId, users.id))
    .where(
      and(
        eq(mfaLoginChallenges.tokenHash, sha256(token)),
        isNull(mfaLoginChallenges.consumedAt),
        gt(mfaLoginChallenges.expiresAt, new Date()),
        isNull(mfaMethods.disabledAt),
      ),
    )
    .limit(1);
  if (!record?.method.verifiedAt)
    throw new ApiError(400, "MFA_CHALLENGE_INVALID", "The MFA challenge is invalid or expired.");
  const verified = await verifyMfaCode(record.method, code);
  if (!verified)
    throw new ApiError(400, "MFA_CODE_INVALID", "The authenticator or recovery code is invalid.");
  const [consumed] = await db
    .update(mfaLoginChallenges)
    .set({ consumedAt: new Date() })
    .where(
      and(eq(mfaLoginChallenges.id, record.challenge.id), isNull(mfaLoginChallenges.consumedAt)),
    )
    .returning({ id: mfaLoginChallenges.id });
  if (!consumed)
    throw new ApiError(400, "MFA_CHALLENGE_INVALID", "The MFA challenge is invalid or expired.");
  await db
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, record.user.id));
  await createSession(record.user.id, request);
  await Promise.all([
    db.insert(notifications).values({
      userId: record.user.id,
      type: "SECURITY_NEW_SESSION",
      title: "New sign-in",
      body: "A new session completed two-factor authentication.",
      href: "/wallet",
    }),
    audit(request, {
      actorUserId: record.user.id,
      action: "session.created_with_mfa",
      entityType: "user",
      entityId: record.user.id,
      metadata: { recoveryCodeUsed: verified.recovery },
    }),
  ]);
  return Response.json({
    data: {
      returnTo: record.challenge.returnTo ?? "/",
      user: { id: record.user.id, systemRole: record.user.systemRole },
    },
  });
});
