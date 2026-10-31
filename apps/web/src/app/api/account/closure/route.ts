import { z } from "zod";
import { withApi } from "@/server/http/errors";
import { credentialsSchema, accountRateLimit } from "@/server/account/http";
import { requestClosure } from "@/server/account/service";
export const POST = withApi(async (request: Request) => {
  const input = credentialsSchema
    .extend({ confirmation: z.literal("DELETE") })
    .parse(await request.json());
  await accountRateLimit(request, input.email, "account_delete");
  const closure = await requestClosure(input);
  return Response.json({
    data: { id: closure.id, processAfter: closure.processAfter, status: "PENDING_DELETION" },
  });
});
