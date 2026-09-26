import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { identityVerifications } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { allowsIdentitySandbox } from "@/server/deployment";
import { audit } from "@/server/audit";
import { notifications } from "@/server/db/schema";

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  if (!allowsIdentitySandbox()) throw new ApiError(404, "NOT_FOUND", "Not found.");
  const { user } = await requireUser();
  const { verificationId, outcome } = z
    .object({ verificationId: z.string().uuid(), outcome: z.enum(["VERIFIED", "REJECTED"]) })
    .parse(await request.json());
  const [updated] = await db
    .update(identityVerifications)
    .set({
      status: outcome,
      verifiedAt: outcome === "VERIFIED" ? new Date() : null,
      expiresAt: outcome === "VERIFIED" ? new Date(Date.now() + 365 * 86_400_000) : null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(identityVerifications.id, verificationId), eq(identityVerifications.userId, user.id)),
    )
    .returning();
  if (!updated)
    throw new ApiError(404, "IDENTITY_VERIFICATION_NOT_FOUND", "Verification was not found.");
  await Promise.all([
    db.insert(notifications).values({
      userId: user.id,
      type: "SECURITY_IDENTITY_UPDATED",
      title: outcome === "VERIFIED" ? "Identity verified" : "Identity check unsuccessful",
      body:
        outcome === "VERIFIED"
          ? "Your identity verification was completed."
          : "Your identity check was not approved. You can start a new check.",
      href: "/identity",
    }),
    audit(request, {
      actorUserId: user.id,
      action: `identity.${outcome.toLowerCase()}`,
      entityType: "identity_verification",
      entityId: updated.id,
      metadata: { provider: updated.provider },
    }),
  ]);
  return Response.json({ data: updated });
});
