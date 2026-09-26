import { and, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/server/audit";
import { enforceAuthRateLimit } from "@/server/auth/rate-limit";
import { issueAuthToken } from "@/server/auth/tokens";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { sendVerificationEmail } from "@/server/email";
import { withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { allowsLocalAuthDelivery } from "@/server/auth/local-mode";

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { email } = z
    .object({
      email: z
        .string()
        .email()
        .max(320)
        .transform((value) => value.toLowerCase()),
    })
    .parse(await request.json());
  await enforceAuthRateLimit({
    action: "verification_resend",
    limit: 3,
    request,
    subject: email,
    windowMs: 60 * 60_000,
  });
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${email}`, isNull(users.emailVerifiedAt)))
    .limit(1);
  let token: string | undefined;
  if (user) {
    token = await issueAuthToken(user.id, "VERIFY_EMAIL");
    try {
      await sendVerificationEmail(user.email, token);
    } catch (error) {
      console.error("Verification email delivery failed.", error);
    }
    await audit(request, {
      actorUserId: user.id,
      action: "account.email_verification_resent",
      entityType: "user",
      entityId: user.id,
    });
  }
  return Response.json({
    data: {
      accepted: true,
      verificationToken: allowsLocalAuthDelivery() ? token : undefined,
    },
  });
});
