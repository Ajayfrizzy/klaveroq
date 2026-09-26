import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { users, verificationTokens } from "@/server/db/schema";
import { withApi, ApiError } from "@/server/http/errors";
import { assertSameOrigin, sha256 } from "@/server/http/security";
import { z } from "zod";
import { audit } from "@/server/audit";

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { token } = z.object({ token: z.string().min(20) }).parse(await request.json());
  const now = new Date();
  const userId = await db.transaction(async (tx) => {
    const [consumed] = await tx
      .update(verificationTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(verificationTokens.tokenHash, sha256(token)),
          eq(verificationTokens.purpose, "VERIFY_EMAIL"),
          isNull(verificationTokens.consumedAt),
          gt(verificationTokens.expiresAt, now),
        ),
      )
      .returning({ userId: verificationTokens.userId });
    if (!consumed)
      throw new ApiError(
        400,
        "VERIFICATION_TOKEN_INVALID",
        "The verification link is invalid or expired.",
      );
    await tx
      .update(users)
      .set({ emailVerifiedAt: now, status: "ACTIVE", updatedAt: now })
      .where(eq(users.id, consumed.userId));
    return consumed.userId;
  });
  await audit(request, {
    actorUserId: userId,
    action: "account.email_verified",
    entityType: "user",
    entityId: userId,
  });
  return Response.json({ data: { verified: true } });
});
