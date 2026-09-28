import { sql } from "drizzle-orm";
import { productionConfigurationIssues } from "@/server/deployment";
import { db } from "@/server/db";
import { withApi } from "@/server/http/errors";
import { identityConfiguration } from "@/server/identity/config";

export const GET = withApi(async () => {
  let database = "ok";
  try {
    await db.execute(sql`select 1`);
  } catch {
    database = "unavailable";
  }
  const configurationIssues = productionConfigurationIssues();
  const ready = database === "ok" && configurationIssues.length === 0;
  return Response.json(
    {
      status: ready ? "ready" : "not_ready",
      dependencies: {
        database,
        email: process.env.EMAIL_PROVIDER === "resend" ? "configured" : "local_or_unconfigured",
        identity: identityConfiguration().betaDisabled
          ? "intentionally_disabled_for_beta"
          : identityConfiguration().real
            ? "configured"
            : "sandbox_or_unconfigured",
        fileStorage:
          process.env.FILE_STORAGE_BACKEND === "spaces" ? "configured" : "local_or_unconfigured",
        fileScanner: process.env.FILE_SCANNER === "clamav" ? "configured" : "local_or_unconfigured",
        monitoring: process.env.ERROR_MONITORING_WEBHOOK_URL ? "configured" : "log_only",
      },
      configurationIssues,
    },
    { status: ready ? 200 : 503 },
  );
});
