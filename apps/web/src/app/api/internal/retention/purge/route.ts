import { audit } from "@/server/audit";
import { ApiError, withApi } from "@/server/http/errors";
import { enforceShortLivedRetention } from "@/server/retention/policy";

export const POST = withApi(async (request: Request) => {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    throw new ApiError(401, "CRON_UNAUTHORIZED", "A valid cron credential is required.");
  const deleted = await enforceShortLivedRetention();
  await audit(request, {
    action: "internal.retention_enforced",
    entityType: "retention_run",
    metadata: deleted,
  });
  return Response.json({ data: { deleted } });
});
