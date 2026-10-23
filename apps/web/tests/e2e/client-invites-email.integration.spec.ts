import { expect, test } from "@playwright/test";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import postgres from "postgres";
import { deliverNotificationEmail } from "../../src/server/email/outbox";
import { expireClientInvitations } from "../../src/features/client-invites/server/expiry";
import { sqlClient } from "../../src/server/db";

test("invitation email failure, retry, expiry and token rotation use the durable outbox", async () => {
  const database = new URL(process.env.DATABASE_URL!);
  if (
    !database.pathname.endsWith("_test") ||
    !["127.0.0.1", "localhost"].includes(database.hostname)
  )
    throw new Error("Isolated database required");
  const sql = postgres(database.toString(), { max: 1 });
  const savedEnv = { ...process.env };
  const savedFetch = globalThis.fetch;
  process.env.APP_URL = "https://beta.example.test";
  process.env.EMAIL_PROVIDER = "resend";
  process.env.RESEND_API_KEY = "fake-test-key";
  process.env.EMAIL_FROM = "Klaveroq <accounts@example.test>";
  let calls = 0;
  let fail = true;
  globalThis.fetch = async () => {
    calls++;
    return fail ? Response.json({}, { status: 503 }) : Response.json({ id: randomUUID() });
  };
  try {
    const [user] =
      await sql`insert into users (email, status, email_verified_at) values (${`outbox-${randomUUID()}@example.test`}, 'ACTIVE', now()) returning id`;
    const token = randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(token).digest("hex");
    const [invite] =
      await sql`insert into client_invites (owner_user_id, email, token_hash, expires_at) values (${user.id}, 'new-client@example.test', ${hash}, now() + interval '7 days') returning id`;
    const [delivery] =
      await sql`insert into notification_deliveries (user_id, recipient, subject, text_body, html_body, dedupe_key, category, token_hash, expires_at) values (${user.id}, 'new-client@example.test', 'Invitation', ${token}, ${token}, ${randomUUID()}, 'CLIENT_INVITE', ${hash}, now() + interval '7 days') returning id`;
    expect(await deliverNotificationEmail(delivery.id)).toBe(false);
    let [row] = await sql`select * from notification_deliveries where id = ${delivery.id}`;
    expect(row.status).toBe("FAILED");
    expect(row.last_error).toBe("RESEND_HTTP_503");
    fail = false;
    await sql`update notification_deliveries set next_attempt_at = now() where id = ${delivery.id}`;
    expect(await deliverNotificationEmail(delivery.id)).toBe(true);
    [row] = await sql`select * from notification_deliveries where id = ${delivery.id}`;
    expect(row.status).toBe("ACCEPTED");
    expect(row.text_body).toBe("");
    expect(row.html_body).toBe("");
    await sql`update notification_deliveries set status = 'PENDING', next_attempt_at = now() where id = ${delivery.id}`;
    await sql`update client_invites set token_hash = ${"b".repeat(64)} where id = ${invite.id}`;
    expect(await deliverNotificationEmail(delivery.id)).toBe(false);
    expect(calls).toBe(2);
    await sql`update client_invites set expires_at = now() - interval '1 second' where id = ${invite.id}`;
    await expireClientInvitations(
      new Request("https://beta.example.test/api/internal/notifications/retry"),
    );
    const [expired] = await sql`select status from client_invites where id = ${invite.id}`;
    expect(expired.status).toBe("EXPIRED");
    const events = await sql`select action from audit_logs where entity_id = ${invite.id}`;
    expect(events.map((event) => event.action)).toContain("client_invite.expired");
  } finally {
    globalThis.fetch = savedFetch;
    process.env = savedEnv;
    await sql.end();
    await sqlClient.end();
  }
});
