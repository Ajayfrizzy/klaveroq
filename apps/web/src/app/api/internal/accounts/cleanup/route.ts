import { audit } from "@/server/audit";
import { timingSafeEqual } from "node:crypto";
import { ApiError, withApi } from "@/server/http/errors";
import { cleanupAccounts } from "@/server/account/cleanup";
export const POST = withApi(async (request: Request) => {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (
    !secret ||
    secret.length < 32 ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    throw new ApiError(401, "CRON_UNAUTHORIZED", "A valid cron credential is required.");
  if (process.env.ACCOUNT_CLEANUP_ENABLED !== "true")
    throw new ApiError(503, "CLEANUP_DISABLED", "Account cleanup has not been activated.");
  const counts = await cleanupAccounts();
  await audit(request, {
    action: "internal.account_cleanup",
    entityType: "account_cleanup_run",
    metadata: counts,
  });
  return Response.json({ data: counts }, { status: counts.failed ? 503 : 200 });
});
