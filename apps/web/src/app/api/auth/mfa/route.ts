import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/server/audit";
import { encryptMfaSecret, generateRecoveryCodes, generateTotpSecret } from "@/server/auth/mfa";
import { verifyPassword } from "@/server/auth/password";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { mfaMethods } from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin, sha256 } from "@/server/http/security";

export const GET = withApi(async () => {
  const { user } = await requireUser();
  const [method] = await db
    .select({
      verifiedAt: mfaMethods.verifiedAt,
      recoveryCodeHashes: mfaMethods.recoveryCodeHashes,
    })
    .from(mfaMethods)
    .where(and(eq(mfaMethods.userId, user.id), isNull(mfaMethods.disabledAt)))
    .limit(1);
  return Response.json({
    data: {
      enabled: Boolean(method?.verifiedAt),
      pending: Boolean(method && !method.verifiedAt),
      recoveryCodesRemaining: method?.verifiedAt ? method.recoveryCodeHashes.length : 0,
    },
  });
});

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  const { password } = z
    .object({ password: z.string().max(128).optional() })
    .parse(await request.json());
  if (user.passwordHash && (!password || !(await verifyPassword(user.passwordHash, password))))
    throw new ApiError(
      403,
      "MFA_REAUTHENTICATION_FAILED",
      "Enter your current password to continue.",
    );
  const [existing] = await db
    .select({ verifiedAt: mfaMethods.verifiedAt })
    .from(mfaMethods)
    .where(and(eq(mfaMethods.userId, user.id), isNull(mfaMethods.disabledAt)))
    .limit(1);
  if (existing?.verifiedAt)
    throw new ApiError(409, "MFA_ALREADY_ENABLED", "Two-factor authentication is already enabled.");
  const secret = generateTotpSecret();
  const recoveryCodes = generateRecoveryCodes();
  await db
    .insert(mfaMethods)
    .values({
      userId: user.id,
      secretEncrypted: encryptMfaSecret(secret),
      recoveryCodeHashes: recoveryCodes.map((code) => sha256(code)),
    })
    .onConflictDoUpdate({
      target: mfaMethods.userId,
      set: {
        secretEncrypted: encryptMfaSecret(secret),
        recoveryCodeHashes: recoveryCodes.map((code) => sha256(code)),
        verifiedAt: null,
        disabledAt: null,
        updatedAt: new Date(),
      },
    });
  await audit(request, {
    actorUserId: user.id,
    action: "mfa.enrollment_started",
    entityType: "user",
    entityId: user.id,
  });
  const label = encodeURIComponent(`Klaveroq:${user.email}`);
  const issuer = encodeURIComponent("Klaveroq");
  return Response.json({
    data: {
      secret,
      recoveryCodes,
      otpauthUri: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
    },
  });
});
