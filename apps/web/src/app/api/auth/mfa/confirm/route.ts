import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/server/audit";
import { decryptMfaSecret, verifyTotp } from "@/server/auth/mfa";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { mfaMethods, notifications } from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  const { code } = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(await request.json());
  const [method] = await db
    .select()
    .from(mfaMethods)
    .where(and(eq(mfaMethods.userId, user.id), isNull(mfaMethods.disabledAt)))
    .limit(1);
  if (!method || method.verifiedAt)
    throw new ApiError(
      409,
      "MFA_ENROLLMENT_NOT_PENDING",
      "No MFA enrollment is awaiting confirmation.",
    );
  if (!verifyTotp(decryptMfaSecret(method.secretEncrypted), code))
    throw new ApiError(400, "MFA_CODE_INVALID", "The authenticator code is invalid or expired.");
  await db.transaction(async (tx) => {
    await tx
      .update(mfaMethods)
      .set({ verifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(mfaMethods.userId, user.id));
    await tx.insert(notifications).values({
      userId: user.id,
      type: "SECURITY_MFA_ENABLED",
      title: "Two-factor authentication enabled",
      body: "Authenticator-app verification is now required when you sign in.",
      href: "/wallet",
    });
  });
  await audit(request, {
    actorUserId: user.id,
    action: "mfa.enabled",
    entityType: "user",
    entityId: user.id,
  });
  return Response.json({ data: { enabled: true } });
});
