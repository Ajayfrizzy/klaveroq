import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { enforceAuthRateLimit } from "@/server/auth/rate-limit";
import { issueAuthToken } from "@/server/auth/tokens";
import { sendPasswordResetEmail } from "@/server/email";
import { audit } from "@/server/audit";
import { allowsLocalAuthDelivery } from "@/server/auth/local-mode";

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { email } = z
    .object({
      email: z
        .string()
        .email()
        .transform((value) => value.toLowerCase()),
    })
    .parse(await request.json());
  await enforceAuthRateLimit({
    action: "password_reset",
    limit: 3,
    request,
    subject: email,
    windowMs: 60 * 60_000,
  });
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  let token: string | undefined;
  if (user) {
    token = await issueAuthToken(user.id, "RESET_PASSWORD");
    try {
      await sendPasswordResetEmail(email, token);
    } catch (error) {
      console.error("Password reset email delivery failed.", error);
    }
    await audit(request, {
      actorUserId: user.id,
      action: "account.password_reset_requested",
      entityType: "user",
      entityId: user.id,
    });
  }
  return Response.json({
    data: {
      accepted: true,
      resetToken: allowsLocalAuthDelivery() ? token : undefined,
    },
  });
});
