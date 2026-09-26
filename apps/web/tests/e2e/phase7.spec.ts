import { expect, request, test } from "@playwright/test";
import postgres from "postgres";

const baseURL = "http://127.0.0.1:3199";
const password = "KlaveroqTest123";
const requestId = "11111111-1111-4111-8111-111111111111";
const cronSecret = "phase7-e2e-cron-secret-at-least-32-characters";
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://klaveroq_test:klaveroq_test@127.0.0.1:55434/klaveroq_test";

test("Phase 7 correlates, audits, deduplicates, reports health, and enforces retention", async () => {
  const suffix = Date.now();
  const email = `phase7-${suffix}@example.test`;
  const bootstrap = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL, "X-Request-Id": requestId },
  });
  const registered = await bootstrap.post("/api/auth/register", {
    data: { email, displayName: "Phase Seven Operator", password },
  });
  expect(registered.status()).toBe(201);
  expect(registered.headers()["x-request-id"]).toBe(requestId);
  const cookie = registered.headers()["set-cookie"]?.split(";")[0];
  expect(cookie).toBeTruthy();
  await bootstrap.dispose();

  const api = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL, Cookie: cookie!, "X-Request-Id": requestId },
  });
  const idempotencyKey = `phase7-listing-${suffix}`;
  const payload = {
    title: "Phase Seven audited listing",
    description:
      "A complete operational fixture used to verify audit correlation and idempotent replay.",
    category: "DEVELOPMENT",
    skills: ["security", "operations"],
    budgetMin: "100000000",
    budgetMax: "200000000",
    proposalDeadline: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    milestones: [
      {
        title: "Operational verification",
        deliverable: "A complete and reviewable operational verification result.",
        acceptanceCriteria: "All Phase Seven checks pass.",
        evidenceRequirements: "Automated test output",
        deliveryDays: 7,
      },
    ],
  };
  const created = await api.post("/api/marketplace/listings", {
    headers: { "Idempotency-Key": idempotencyKey },
    data: payload,
  });
  expect(created.status()).toBe(201);
  expect(created.headers()["x-request-id"]).toBe(requestId);
  const listingId = (await created.json()).data.id as string;
  const replay = await api.post("/api/marketplace/listings", {
    headers: { "Idempotency-Key": idempotencyKey },
    data: payload,
  });
  expect(replay.status()).toBe(200);
  expect((await replay.json()).data.id).toBe(listingId);

  const malformed = await api.get("/api/marketplace/listings?cursor=malformed");
  expect(malformed.status()).toBe(400);
  expect((await malformed.json()).error.requestId).toBe(requestId);

  const anonymous = await request.newContext({ baseURL });
  const live = await anonymous.get("/api/health/live");
  const ready = await anonymous.get("/api/health/ready");
  expect(live.status()).toBe(200);
  expect((await live.json()).status).toBe("ok");
  expect(ready.status()).toBe(200);
  expect((await ready.json()).dependencies.database).toBe("ok");

  const sql = postgres(testDatabaseUrl, { max: 1 });
  const [user] = await sql<{ id: string }[]>`select id from users where email = ${email}`;
  const [listingAudit] = await sql<
    { actor_user_id: string; entity_id: string; correlation_id: string }[]
  >`
    select actor_user_id, entity_id, correlation_id
    from audit_logs where action = 'listing.created' and entity_id = ${listingId}
  `;
  expect(listingAudit).toEqual({
    actor_user_id: user.id,
    entity_id: listingId,
    correlation_id: requestId,
  });
  const [operationCount] = await sql<{ count: number }[]>`
    select count(*)::int count from operations
    where idempotency_key = ${`create-listing:${user.id}:${idempotencyKey}`}
  `;
  expect(operationCount.count).toBe(1);

  await sql`
    insert into auth_rate_limits (action, key_hash, window_started_at, updated_at)
    values ('phase7-expired', 'expired-key', now() - interval '3 days', now() - interval '3 days')
  `;
  const retention = await anonymous.post("/api/internal/retention/purge", {
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  expect(retention.status()).toBe(200);
  expect((await retention.json()).data.deleted.rateLimits).toBeGreaterThanOrEqual(1);
  const [expiredCount] = await sql<{ count: number }[]>`
    select count(*)::int count from auth_rate_limits where action = 'phase7-expired'
  `;
  expect(expiredCount.count).toBe(0);
  const [retentionAudit] = await sql<{ count: number }[]>`
    select count(*)::int count from audit_logs where action = 'internal.retention_enforced'
  `;
  expect(retentionAudit.count).toBe(1);

  await sql.end();
  await api.dispose();
  await anonymous.dispose();
});
