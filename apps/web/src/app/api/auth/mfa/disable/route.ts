import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/server/audit";
import { verifyMfaCode } from "@/server/auth/mfa";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { mfaMethods, notifications } from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  const { code } = z.object({ code: z.string().min(6).max(40) }).parse(await request.json());
  const [method] = await db
    .select()
    .from(mfaMethods)
    .where(and(eq(mfaMethods.userId, user.id), isNull(mfaMethods.disabledAt)))
    .limit(1);
  if (!method?.verifiedAt) throw new ApiError(409, "MFA_NOT_ENABLED", "MFA is not enabled.");
  if (!(await verifyMfaCode(method, code)))
    throw new ApiError(400, "MFA_CODE_INVALID", "The authenticator or recovery code is invalid.");
  await db.transaction(async (tx) => {
    await tx
      .update(mfaMethods)
      .set({ disabledAt: new Date(), updatedAt: new Date() })
      .where(eq(mfaMethods.userId, user.id));
    await tx.insert(notifications).values({
      userId: user.id,
      type: "SECURITY_MFA_DISABLED",
      title: "Two-factor authentication disabled",
      body: "Authenticator-app verification is no longer required at sign-in.",
      href: "/wallet",
    });
  });
  await audit(request, {
    actorUserId: user.id,
    action: "mfa.disabled",
    entityType: "user",
    entityId: user.id,
  });
  return Response.json({ data: { enabled: false } });
});
