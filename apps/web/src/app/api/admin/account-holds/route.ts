import { z } from "zod";
import { withApi } from "@/server/http/errors";
import { requireUser } from "@/server/auth/session";
import { requireRole } from "@/server/auth/authorization";
import { accountRateLimit } from "@/server/account/http";
import { setAccountHold } from "@/server/account/service";
export const POST = withApi(async (request: Request) => {
  const { user } = await requireUser();
  requireRole(user.systemRole, ["RISK_ADMIN", "SUPER_ADMIN"]);
  await accountRateLimit(request, user.email, "account_hold");
  const input = z
    .object({
      userId: z.string().uuid(),
      reason: z.string().trim().min(10).max(500),
      releaseId: z.string().uuid().optional(),
    })
    .parse(await request.json());
  await setAccountHold(user.id, input.userId, input.reason, input.releaseId);
  return Response.json({ data: { recorded: true } });
});
