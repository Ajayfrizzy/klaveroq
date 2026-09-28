import { timingSafeEqual } from "node:crypto";
import { audit } from "@/server/audit";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { ApiError, withApi } from "@/server/http/errors";
import {
  enqueueSecurityEmails,
  retryPendingNotificationEmails,
} from "@/server/notifications/service";
import { log } from "@/server/observability/logger";

export const maxDuration = 300;

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
  return db.transaction(async (tx) => {
    const [lock] = await tx.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_xact_lock(72849102) as locked`,
    );
    if (!lock.locked) return Response.json({ data: { skipped: "already_running" } });
    const enqueued = await enqueueSecurityEmails();
    const outcomes = await retryPendingNotificationEmails(25);
    const counts = await db.execute(
      sql`select status, count(*)::int as count from notification_deliveries group by status`,
    );
    const result = {
      enqueued,
      processed: outcomes.length,
      acceptedOrSimulated: outcomes.filter(Boolean).length,
      counts,
    };
    log.info("email.retry_run", {
      enqueued,
      processed: outcomes.length,
      acceptedOrSimulated: result.acceptedOrSimulated,
    });
    await audit(request, {
      action: "internal.email_retry",
      entityType: "email_retry_run",
      metadata: { enqueued, processed: outcomes.length },
    });
    return Response.json({ data: result });
  });
});
