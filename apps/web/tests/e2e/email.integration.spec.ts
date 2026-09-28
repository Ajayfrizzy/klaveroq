import { test, expect } from "@playwright/test";
import { createHmac, randomUUID } from "node:crypto";
import postgres from "postgres";
import { notifyUser, enqueueSecurityEmails } from "../../src/server/notifications/service";
import {
  deliverNotificationEmail,
  retryPendingNotificationEmails,
} from "../../src/server/email/outbox";
import { POST as webhook } from "../../src/app/api/webhooks/resend/route";
import { POST as cron } from "../../src/app/api/internal/notifications/retry/route";
import { issueAuthToken } from "../../src/server/auth/tokens";
import { sendVerificationEmail, sendPasswordResetEmail } from "../../src/server/email";
import { sqlClient } from "../../src/server/db";

test("email outbox: real provider contract, retries, security, preferences and signed receipts", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test"))
    throw new Error("Explicit isolated TEST_DATABASE_URL required");
  const originalEnv = { ...process.env };
  const realFetch = globalThis.fetch;
  process.env.DATABASE_URL = databaseUrl;
  process.env.APP_URL = "https://beta.example.test";
  process.env.EMAIL_PROVIDER = "resend";
  process.env.RESEND_API_KEY = "isolated-fake-key";
  process.env.EMAIL_FROM = "Klaveroq <accounts@example.test>";
  process.env.CRON_SECRET = "email-test-cron-secret-at-least-32-characters";
  process.env.RESEND_WEBHOOK_SECRET = `whsec_${Buffer.alloc(32, 7).toString("base64")}`;
  const sql = postgres(databaseUrl, { max: 1 });
  const calls: { key: string; payload: Record<string, string> }[] = [];
  const accepted = new Map<string, string>();
  let failure = 0;
  let ambiguous = false;
  globalThis.fetch = async (input, init) => {
    if (String(input) !== "https://api.resend.com/emails")
      throw new Error("Unexpected outbound request");
    const key = new Headers(init?.headers).get("Idempotency-Key")!;
    calls.push({ key, payload: JSON.parse(init?.body as string) });
    if (failure) return Response.json({ name: "test_error" }, { status: failure });
    const id = accepted.get(key) ?? randomUUID();
    accepted.set(key, id);
    if (ambiguous) {
      ambiguous = false;
      throw new Error("Connection lost after provider acceptance");
    }
    return Response.json({ id });
  };
  try {
    const [user] =
      await sql`insert into users (email) values (${`email-${randomUUID()}@example.test`}) returning id,email`;
    const notify = (
      category: "PROPOSAL" | "MESSAGE" | "JOB" | "DISPUTE" | "SUPPORT" | "SECURITY",
      key = randomUUID(),
    ) =>
      notifyUser({
        userId: user.id,
        type: category,
        category,
        title: "Private customer title",
        body: "Secret message contents",
        href: "/jobs",
        dedupeKey: key,
      });
    for (const category of [
      "PROPOSAL",
      "MESSAGE",
      "JOB",
      "DISPUTE",
      "SUPPORT",
      "SECURITY",
    ] as const)
      await notify(category);
    expect(calls).toHaveLength(6);
    for (const call of calls) {
      expect(call.payload.html).not.toContain("Secret message contents");
      expect(call.payload.text).toContain("https://beta.example.test/");
    }
    const [row] =
      await sql`select * from notification_deliveries where user_id=${user.id} order by created_at limit 1`;
    expect(row.status).toBe("ACCEPTED");
    expect(row.delivered_at).toBeNull();
    expect(row.provider_id).toBeTruthy();
    const key = randomUUID();
    await Promise.all([notify("JOB", key), notify("JOB", key)]);
    expect(calls).toHaveLength(7);
    failure = 503;
    await notify("JOB");
    const [retry] =
      await sql`select * from notification_deliveries where user_id=${user.id} and status='FAILED'`;
    expect(retry.attempts).toBe(1);
    await deliverNotificationEmail(retry.id);
    expect(calls).toHaveLength(8);
    failure = 0;
    ambiguous = true;
    await sql`update notification_deliveries set next_attempt_at=now() where id=${retry.id}`;
    await Promise.all([deliverNotificationEmail(retry.id), deliverNotificationEmail(retry.id)]);
    const ambiguousId = accepted.get(calls.at(-1)!.key);
    await sql`update notification_deliveries set status='PROCESSING', updated_at=now()-interval '11 minutes' where id=${retry.id}`;
    await retryPendingNotificationEmails();
    const [recovered] = await sql`select * from notification_deliveries where id=${retry.id}`;
    expect(recovered.status).toBe("ACCEPTED");
    expect(recovered.provider_id).toBe(ambiguousId);
    failure = 422;
    await notify("JOB");
    const [permanent] =
      await sql`select * from notification_deliveries where user_id=${user.id} and status='PERMANENT_FAILURE'`;
    expect(permanent.last_error).toBe("RESEND_HTTP_422");
    failure = 0;
    await sql`insert into notification_preferences (user_id,proposal_emails,message_emails,job_emails,dispute_emails,support_emails) values (${user.id},false,false,false,false,false)`;
    const before = calls.length;
    await notify("MESSAGE");
    expect(calls).toHaveLength(before);
    await sql`insert into notifications (user_id,type,title,body) values (${user.id},'SECURITY_PASSWORD_CHANGED','Password changed','Private detail')`;
    await enqueueSecurityEmails();
    await retryPendingNotificationEmails();
    expect(calls.length).toBeGreaterThan(before);
    const count = calls.length;
    await enqueueSecurityEmails();
    await retryPendingNotificationEmails();
    expect(calls).toHaveLength(count);
    const token = await issueAuthToken(user.id, "VERIFY_EMAIL");
    process.env.APP_URL = "http://127.0.0.1:3199";
    expect((await sendVerificationEmail(user.email, token)).status).toBe("ACCEPTED");
    expect(calls.at(-1)!.payload.text).toContain(`/verify-email?token=${token}`);
    await page.goto(`http://127.0.0.1:3199/verify-email?token=${token}`);
    await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
    const reset = await issueAuthToken(user.id, "RESET_PASSWORD");
    expect((await sendPasswordResetEmail(user.email, reset)).status).toBe("ACCEPTED");
    expect(calls.at(-1)!.payload.html).toContain("/reset-password?token=");
    await page.goto(`http://127.0.0.1:3199/reset-password?token=${reset}`);
    await page.getByLabel("New password", { exact: true }).fill("EmailIntegration123!");
    await page.getByLabel("Confirm new password").fill("EmailIntegration123!");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();
    const authRows =
      await sql`select html_body,text_body from notification_deliveries where user_id=${user.id} and category='AUTH'`;
    expect(authRows.every((r) => !r.html_body && !r.text_body)).toBe(true);
    failure = 503;
    const expired = await issueAuthToken(user.id, "RESET_PASSWORD");
    await sendPasswordResetEmail(user.email, expired);
    await issueAuthToken(user.id, "RESET_PASSWORD");
    const [stale] =
      await sql`select id from notification_deliveries where user_id=${user.id} and status='FAILED'`;
    await sql`update notification_deliveries set next_attempt_at=now() where id=${stale.id}`;
    await deliverNotificationEmail(stale.id);
    expect(
      (await sql`select status from notification_deliveries where id=${stale.id}`)[0].status,
    ).toBe("EXPIRED");
    failure = 0;
    process.env.EMAIL_PROVIDER = "local";
    await notify("SECURITY");
    expect(
      (
        await sql`select count(*)::int n from notification_deliveries where user_id=${user.id} and status='SIMULATED' and delivered_at is null`
      )[0].n,
    ).toBe(1);
    process.env.EMAIL_PROVIDER = "resend";
    await sql`update notification_deliveries set status='FAILED',attempts=5,next_attempt_at=now() where id=${permanent.id}`;
    await retryPendingNotificationEmails();
    expect(
      (await sql`select status from notification_deliveries where id=${permanent.id}`)[0].status,
    ).toBe("REVIEW_REQUIRED");
    await sql`update notification_deliveries set status='FAILED',attempts=1,category='SECURITY',first_attempt_at=now()-interval '24 hours',next_attempt_at=now() where id=${permanent.id}`;
    const prior = calls.length;
    await deliverNotificationEmail(permanent.id);
    expect(calls).toHaveLength(prior);
    // Preferences are checked again when retrying an already queued optional email.
    await sql`update notification_deliveries set status='FAILED', attempts=1, category='MESSAGE', first_attempt_at=null, next_attempt_at=now() where id=${permanent.id}`;
    await deliverNotificationEmail(permanent.id);
    expect(
      (await sql`select status from notification_deliveries where id=${permanent.id}`)[0].status,
    ).toBe("SUPPRESSED");
    expect(calls).toHaveLength(prior);
    const raw = JSON.stringify({
      type: "email.delivered",
      created_at: new Date().toISOString(),
      data: { email_id: row.provider_id },
    });
    const stamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", Buffer.alloc(32, 7))
      .update(`event-1.${stamp}.${raw}`)
      .digest("base64");
    const hookRequest = () =>
      new Request("https://beta.example.test/api/webhooks/resend", {
        method: "POST",
        body: raw,
        headers: {
          "svix-id": "event-1",
          "svix-timestamp": stamp,
          "svix-signature": `v1,${signature}`,
        },
      });
    expect((await webhook(hookRequest())).status).toBe(200);
    expect((await webhook(hookRequest())).status).toBe(200);
    expect(
      (await sql`select status from notification_deliveries where id=${row.id}`)[0].status,
    ).toBe("DELIVERED");
    const bounced = JSON.stringify({
      type: "email.bounced",
      created_at: new Date(Date.now() + 1000).toISOString(),
      data: { email_id: row.provider_id },
    });
    const bounceSignature = createHmac("sha256", Buffer.alloc(32, 7))
      .update(`event-2.${stamp}.${bounced}`)
      .digest("base64");
    expect(
      (
        await webhook(
          new Request("https://beta.example.test/api/webhooks/resend", {
            method: "POST",
            body: bounced,
            headers: {
              "svix-id": "event-2",
              "svix-timestamp": stamp,
              "svix-signature": `v1,${bounceSignature}`,
            },
          }),
        )
      ).status,
    ).toBe(200);
    await webhook(hookRequest());
    expect(
      (await sql`select status from notification_deliveries where id=${row.id}`)[0].status,
    ).toBe("BOUNCED");
    expect(
      (
        await webhook(
          new Request("https://beta.example.test/api/webhooks/resend", {
            method: "POST",
            body: raw,
          }),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await cron(
          new Request("https://beta.example.test/api/internal/notifications/retry", {
            method: "POST",
          }),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await cron(
          new Request("https://beta.example.test/api/internal/notifications/retry", {
            method: "POST",
            headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
          }),
        )
      ).status,
    ).toBe(200);
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(72849102)`;
      const response = await cron(
        new Request("https://beta.example.test/api/internal/notifications/retry", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        }),
      );
      expect((await response.json()).data.skipped).toBe("already_running");
    });
  } finally {
    globalThis.fetch = realFetch;
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    await sql.end();
    await sqlClient.end();
  }
});
