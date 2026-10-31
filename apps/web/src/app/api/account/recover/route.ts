import { z } from "zod";
import { withApi } from "@/server/http/errors";
import { credentialsSchema, accountRateLimit } from "@/server/account/http";
import { recoverAccount } from "@/server/account/service";
export const POST = withApi(async (request: Request) => {
  const input = credentialsSchema
    .extend({ confirmation: z.literal("RECOVER") })
    .parse(await request.json());
  await accountRateLimit(request, input.email, "account_recover");
  await recoverAccount(input);
  return Response.json({ data: { recovered: true } });
});
