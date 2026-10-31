import { z } from "zod";
import { withApi } from "@/server/http/errors";
import { accountRateLimit } from "@/server/account/http";
import { issueEmailConfirmation } from "@/server/account/service";
import { getCurrentUser } from "@/server/auth/session";
import { allowsLocalAuthDelivery } from "@/server/auth/local-mode";
export const POST = withApi(async (request: Request) => {
  const input = z
    .object({
      email: z
        .string()
        .email()
        .max(320)
        .transform((v) => v.toLowerCase()),
      action: z.enum(["delete", "recover"]),
    })
    .parse(await request.json());
  await accountRateLimit(request, input.email, "account_confirmation");
  const current = await getCurrentUser();
  const token = await issueEmailConfirmation(input.email, input.action, current?.user.id);
  return Response.json({
    data: { accepted: true, token: allowsLocalAuthDelivery() ? token : undefined },
  });
});
