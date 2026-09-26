import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { profiles, users } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";
import { registerSchema } from "@/server/auth/schemas";
import { createSession } from "@/server/auth/session";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { audit } from "@/server/audit";
import { enforceAuthRateLimit } from "@/server/auth/rate-limit";
import { issueAuthToken } from "@/server/auth/tokens";
import { sendVerificationEmail } from "@/server/email";
import { allowsLocalAuthDelivery } from "@/server/auth/local-mode";

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const input = registerSchema.parse(await request.json());
  await enforceAuthRateLimit({
    action: "register",
    limit: 20,
    request,
    windowMs: 60 * 60_000,
  });
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${input.email}`)
    .limit(1);
  if (existing.length)
    throw new ApiError(409, "EMAIL_ALREADY_REGISTERED", "An account already uses this email.");
  const passwordHash = await hashPassword(input.password);
  const user = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({ email: input.email, passwordHash })
      .returning();
    await tx.insert(profiles).values({ userId: created.id, displayName: input.displayName });
    return created;
  });
  const verificationToken = await issueAuthToken(user.id, "VERIFY_EMAIL");
  let emailSent = true;
  try {
    await sendVerificationEmail(user.email, verificationToken);
  } catch (error) {
    emailSent = false;
    console.error("Verification email delivery failed.", error);
  }
  await createSession(user.id, request);
  await audit(request, {
    actorUserId: user.id,
    action: "account.registered",
    entityType: "user",
    entityId: user.id,
  });
  return Response.json(
    {
      data: {
        user: { id: user.id, email: user.email, status: user.status },
        emailSent,
        verificationToken: allowsLocalAuthDelivery() ? verificationToken : undefined,
      },
    },
    { status: 201 },
  );
});
