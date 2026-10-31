import { expect, test, request as requests, type APIRequestContext } from "@playwright/test";
import postgres from "postgres";
import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { encryptMfaSecret, totpCode } from "../../src/server/auth/mfa";
import { createHash } from "node:crypto";
const origin = "http://127.0.0.1:3199";
const password = "LifecyclePassword123";
const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1 });
const cron = "phase7-e2e-cron-secret-at-least-32-characters";
process.env.MFA_ENCRYPTION_KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const contexts: APIRequestContext[] = [];
async function account() {
  let api = await requests.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  contexts.push(api);
  const email = `lifecycle-${crypto.randomUUID()}@example.test`;
  const r = await api.post("/api/auth/register", {
    data: { email, password, displayName: "Lifecycle Tester" },
  });
  expect(r.status()).toBe(201);
  const data = (await r.json()).data;
  api = await requests.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin, Cookie: r.headers()["set-cookie"].split(";")[0] },
    storageState: await api.storageState(),
  });
  contexts.push(api);
  expect(
    (
      await api.post("/api/auth/verify-email", { data: { token: data.verificationToken } })
    ).status(),
  ).toBe(200);
  return { api, email, id: data.user.id as string };
}
type Account = Awaited<ReturnType<typeof account>>;
const close = (a: Account, extra = {}) =>
  a.api.post("/api/account/closure", {
    data: { email: a.email, password, confirmation: "DELETE", ...extra },
  });
const recover = (a: Account, extra = {}) =>
  a.api.post("/api/account/recover", {
    data: { email: a.email, password, confirmation: "RECOVER", ...extra },
  });
async function due(a: Account) {
  await sql`update account_closures set process_after=now()-interval '1 second',review_after=null where user_id=${a.id} and recovered_at is null`;
}
const sweep = (api: APIRequestContext) =>
  api.post("/api/internal/accounts/cleanup", { headers: { Authorization: `Bearer ${cron}` } });
async function job(a: Account, status = "IN_PROGRESS") {
  const [j] =
    await sql`insert into jobs(reference,client_user_id,worker_email,title,description,subtotal,client_fee,network_reserve,status) values(${crypto.randomUUID().slice(0, 25)},${a.id},'counterparty@example.test','Synthetic agreement','Shared evidence',100,0,0,${status}) returning id`;
  return j.id as string;
}
test.beforeEach(async () => {
  await sql`delete from auth_rate_limits`;
});
test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.dispose()));
});
test.afterAll(async () => {
  await sql.end();
});

test("profile removal preserves authentication and offers explicit private repair", async ({
  page,
}) => {
  const a = await account();
  await sql`delete from profiles where user_id=${a.id}`;
  const login = await a.api.post("/api/auth/login", { data: { email: a.email, password } });
  expect(login.status()).toBe(200);
  await page.context().addCookies((await a.api.storageState()).cookies);
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/account\/settings/);
  await expect(page.getByText(/Your sign-in works/)).toBeVisible();
  await page.getByLabel("New display name").fill("Repaired Tester");
  await page.getByRole("button", { name: "Create private profile" }).click();
  await expect(page).toHaveURL("/profile");
  const [p] = await sql`select is_public from profiles where user_id=${a.id}`;
  expect(p.is_public).toBe(false);
  await expect(sql`delete from users where id=${a.id}`).rejects.toMatchObject({ code: "23503" });
});

test("confirmation, fresh authentication, origin and session revocation; idempotent concurrent requests", async () => {
  const a = await account();
  await sql`update profiles set is_public=true, headline='Professional designer', primary_role='Designer', bio='I design thoughtful accessible digital products for professional teams.', skills='["design"]', experience_level='SENIOR',country_code='NG',timezone='Africa/Lagos' where user_id=${a.id}`;
  expect((await close(a, { confirmation: "yes" })).status()).toBe(400);
  expect((await close(a, { password: "wrong" })).status()).toBe(401);
  expect(
    (
      await a.api.post("/api/account/closure", {
        headers: { Origin: "https://evil.test" },
        data: { email: a.email, password, confirmation: "DELETE" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await a.api.post("/api/account/closure", {
        data: { email: a.email, password, confirmation: "DELETE", padding: "x".repeat(20_000) },
      })
    ).status(),
  ).toBe(413);
  const responses = await Promise.all([close(a), close(a)]);
  for (const r of responses) expect(r.status()).toBe(200);
  const bodies = await Promise.all(responses.map((r) => r.json()));
  expect(bodies[0].data.id).toBe(bodies[1].data.id);
  const [closure] =
    await sql`select extract(epoch from(process_after-requested_at))/86400 as days from account_closures where user_id=${a.id}`;
  expect(Number(closure.days)).toBe(30);
  expect((await a.api.get("/api/profile")).status()).toBe(401);
  expect(
    (
      await a.api.post("/api/client-invites/respond", {
        data: { token: "x".repeat(32), action: "accept" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (await a.api.post("/api/auth/login", { data: { email: a.email, password } })).status(),
  ).toBe(403);
  expect((await a.api.get(`/api/talent/${a.id}`)).status()).toBe(404);
  const [p] = await sql`select is_public from profiles where user_id=${a.id}`;
  expect(p.is_public).toBe(false);
  const restored = await Promise.all([recover(a), recover(a)]);
  expect(restored.map((r) => r.status()).sort()).toEqual([200, 409]);
  const [r] =
    await sql`select u.status,p.is_public from users u join profiles p on p.user_id=u.id where u.id=${a.id}`;
  expect(r).toMatchObject({ status: "ACTIVE", is_public: true });
  expect((await a.api.get("/api/profile")).status()).toBe(401);
  expect(
    (await a.api.post("/api/auth/login", { data: { email: a.email, password } })).status(),
  ).toBe(200);
});

test("MFA required for deletion and recovery; one-use recovery codes and stale challenges", async () => {
  const a = await account();
  const secret = "JBSWY3DPEHPK3PXP";
  const recoveryCode = "1234567890ABCDEF1234";
  await sql`insert into mfa_methods(user_id,secret_encrypted,recovery_code_hashes,verified_at) values(${a.id},${encryptMfaSecret(secret)},${JSON.stringify([sha(recoveryCode)])}::jsonb,now())`;
  expect((await close(a)).status()).toBe(401);
  const login = await a.api.post("/api/auth/login", { data: { email: a.email, password } });
  const challenge = (await login.json()).data.mfaToken;
  expect((await close(a, { code: totpCode(secret) })).status()).toBe(200);
  expect(
    (
      await a.api.post("/api/auth/mfa/challenge", {
        data: { token: challenge, code: totpCode(secret) },
      })
    ).status(),
  ).toBe(400);
  expect((await recover(a)).status()).toBe(401);
  expect((await recover(a, { code: recoveryCode })).status()).toBe(200);
  expect((await close(a, { code: recoveryCode })).status()).toBe(401);
});

test("Google-only email confirmation is short-lived, action-bound and single-use", async () => {
  const a = await account();
  await sql`update users set password_hash=null where id=${a.id}`;
  await sql`insert into auth_identities(user_id,provider,provider_subject,provider_email) values(${a.id},'google',${crypto.randomUUID()},${a.email})`;
  const confirmation = await a.api.post("/api/account/confirmation", {
    data: { email: a.email, action: "delete" },
  });
  const token = (await confirmation.json()).data.token;
  expect(token).toBeTruthy();
  await sql`update verification_tokens set expires_at=now()-interval '1 second' where token_hash=${sha(token)}`;
  expect((await close(a, { password: undefined, token })).status()).toBe(401);
  const again = await a.api.post("/api/account/confirmation", {
    data: { email: a.email, action: "delete" },
  });
  const fresh = (await again.json()).data.token;
  expect((await close(a, { password: undefined, token: fresh })).status()).toBe(200);
  expect((await recover(a, { password: undefined, token: fresh })).status()).toBe(401);
  const rr = await a.api.post("/api/account/confirmation", {
    data: { email: a.email, action: "recover" },
  });
  const recoveryToken = (await rr.json()).data.token;
  expect((await recover(a, { password: undefined, token: recoveryToken })).status()).toBe(200);
  expect((await recover(a, { password: undefined, token: recoveryToken })).status()).toBe(401);
});

test("expired recovery, cleanup authorization, no-activity anonymization and audit preservation", async () => {
  const a = await account();
  expect((await close(a)).status()).toBe(200);
  await due(a);
  expect((await recover(a)).status()).toBe(409);
  expect((await a.api.post("/api/internal/accounts/cleanup")).status()).toBe(401);
  const [before] = await sql`select count(*)::int n from audit_logs where actor_user_id=${a.id}`;
  expect((await sweep(a.api)).status()).toBe(200);
  const [u] = await sql`select status,email,password_hash from users where id=${a.id}`;
  expect(u.status).toBe("ANONYMIZED");
  expect(u.email).toContain("@account.invalid");
  expect(u.password_hash).toBeNull();
  const [after] = await sql`select count(*)::int n from audit_logs where actor_user_id=${a.id}`;
  expect(after.n).toBeGreaterThan(before.n);
  const [stamp] = await sql`select processed_at from account_closures where user_id=${a.id}`;
  await sweep(a.api);
  const [stamp2] = await sql`select processed_at from account_closures where user_id=${a.id}`;
  expect(stamp2.processed_at).toEqual(stamp.processed_at);
});

test("active agreements and disputes block requests; completed history survives closure", async () => {
  const a = await account();
  const j = await job(a);
  expect((await close(a)).status()).toBe(409);
  await sql`update jobs set status='COMPLETED' where id=${j}`;
  const [d] =
    await sql`insert into disputes(reference,job_id,opened_by,reason_code,description,evidence_due_at) values(${crypto.randomUUID().slice(0, 25)},${j},${a.id},'OTHER','Shared evidence',now()) returning id`;
  expect((await close(a)).status()).toBe(409);
  await sql`update disputes set status='CLOSED' where id=${d.id}`;
  await sql`insert into operations(job_id,initiated_by,type,idempotency_key,status,amount,asset) values(${j},${a.id},'RELEASE',${crypto.randomUUID()},'CONFIRMED',100,'CKB')`;
  expect((await close(a)).status()).toBe(200);
  await due(a);
  await sweep(a.api);
  const [u] = await sql`select status from users where id=${a.id}`;
  expect(u.status).toBe("CLOSED_RETAINED");
  const [history] =
    await sql`select j.description,o.amount from jobs j join operations o on o.job_id=j.id where j.id=${j}`;
  expect(history.description).toBe("Shared evidence");
  expect(String(history.amount)).toBe("100");
  expect(
    (await a.api.post("/api/auth/login", { data: { email: a.email, password } })).status(),
  ).toBe(401);
});

test("unsettled operations, suspension and legal holds prevent unsafe transitions", async () => {
  const a = await account();
  const [op] =
    await sql`insert into operations(initiated_by,type,idempotency_key,status) values(${a.id},'REFUND',${crypto.randomUUID()},'PENDING') returning id`;
  expect((await close(a)).status()).toBe(409);
  await sql`update operations set status='CANCELLED' where id=${op.id}`;
  const staff = await account();
  await sql`update users set system_role='RISK_ADMIN' where id=${staff.id}`;
  expect(
    (
      await a.api.post("/api/admin/account-holds", {
        data: { userId: a.id, reason: "Synthetic investigation" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await staff.api.post("/api/admin/account-holds", {
        data: { userId: a.id, reason: "Synthetic investigation" },
      })
    ).status(),
  ).toBe(200);
  expect((await close(a)).status()).toBe(409);
  const [hold] = await sql`select id from account_holds where user_id=${a.id}`;
  await staff.api.post("/api/admin/account-holds", {
    data: { userId: a.id, reason: "Review completed", releaseId: hold.id },
  });
  expect((await close(a)).status()).toBe(200);
  await staff.api.post("/api/admin/account-holds", {
    data: { userId: a.id, reason: "New evidence received" },
  });
  expect((await recover(a)).status()).toBe(403);
  await due(a);
  await sweep(a.api);
  const [pending] = await sql`select status from users where id=${a.id}`;
  expect(pending.status).toBe("PENDING_DELETION");
  await sql`update users set status='SUSPENDED' where id=${a.id}`;
  expect((await recover(a)).status()).toBe(409);
  expect(
    (await a.api.post("/api/auth/login", { data: { email: a.email, password } })).status(),
  ).toBe(403);
  const r = await staff.api.get("/api/admin/account-requests");
  expect(r.status()).toBe(200);
});

test("late obligations defer cleanup; failed transaction retries without partial scrubbing", async () => {
  const a = await account();
  await close(a);
  const j = await job(a);
  await due(a);
  await sweep(a.api);
  const [deferred] = await sql`select last_error from account_closures where user_id=${a.id}`;
  expect(deferred.last_error).toBe("REVIEW_REQUIRED");
  await sql`update jobs set status='CANCELLED' where id=${j}`;
  await due(a);
  // Inject a test-only DB failure into this synthetic user's cleanup transaction.
  await sql.unsafe(
    `create or replace function m2_fail_cleanup() returns trigger language plpgsql as $$ begin if new.id = '${a.id}' and new.status = 'CLOSED_RETAINED' then raise exception 'synthetic cleanup failure'; end if; return new; end $$`,
  );
  await sql.unsafe(
    "create trigger m2_cleanup_failure before update on users for each row execute function m2_fail_cleanup()",
  );
  try {
    expect((await sweep(a.api)).status()).toBe(503);
    const [u] = await sql`select email,status from users where id=${a.id}`;
    expect(u).toMatchObject({ email: a.email, status: "PENDING_DELETION" });
    const [c] = await sql`select last_error from account_closures where user_id=${a.id}`;
    expect(c.last_error).toBe("CLEANUP_FAILED");
  } finally {
    await sql.unsafe("drop trigger m2_cleanup_failure on users");
    await sql.unsafe("drop function m2_fail_cleanup()");
  }
  await due(a);
  expect((await sweep(a.api)).status()).toBe(200);
  const [u] = await sql`select status from users where id=${a.id}`;
  expect(u.status).toBe("CLOSED_RETAINED");
});

test("verification and reset tokens cannot revive pending accounts; privacy requests remain available", async () => {
  const a = await account();
  await close(a);
  for (const purpose of ["VERIFY_EMAIL", "RESET_PASSWORD"]) {
    const token = crypto.randomUUID();
    await sql`insert into verification_tokens(user_id,purpose,token_hash,expires_at) values(${a.id},${purpose},${sha(token)},now()+interval '1 hour')`;
    const r = await a.api.post(
      purpose === "VERIFY_EMAIL" ? "/api/auth/verify-email" : "/api/auth/password/reset",
      { data: { token, password: "ChangedPassword123" } },
    );
    expect(r.status()).toBe(403);
  }
  expect(
    (
      await a.api.post("/api/account/privacy", {
        data: { email: a.email, message: "Please review my request for earlier privacy handling." },
      })
    ).status(),
  ).toBe(201);
  expect((await a.api.get("/api/admin/account-requests")).status()).toBe(401);
});

for (const width of [1280, 375, 390])
  test(`account deletion and recovery UX ${width}`, async ({ page }) => {
    const a = await account();
    await page.context().addCookies((await a.api.storageState()).cookies);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/account/settings");
    await expect(page.getByRole("heading", { name: "Delete account" })).toBeVisible();
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await mkdir("../../docs/account-lifecycle/screenshots", { recursive: true });
    await page.screenshot({
      path: `../../docs/account-lifecycle/screenshots/delete-${width}.png`,
      fullPage: true,
    });
    await page.getByLabel("Current password").fill(password);
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await page.getByRole("button", { name: "Confirm deletion request" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Account deletion scheduled" })).toBeVisible();
    await page.screenshot({
      path: `../../docs/account-lifecycle/screenshots/pending-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("link", { name: "Recover account", exact: true }).click();
    await page.getByLabel("Email", { exact: true }).fill(a.email);
    await page.getByLabel("Current password").fill(password);
    await page.getByLabel("Type RECOVER to confirm").fill("RECOVER");
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `../../docs/account-lifecycle/screenshots/recover-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Cancel deletion and recover" }).click();
    await expect(page.getByRole("heading", { name: "Account recovered" })).toBeVisible();
  });

test("legal holds protect old authentication evidence from the existing retention job", async () => {
  const a = await account();
  const staff = await account();
  await sql`update users set system_role='RISK_ADMIN' where id=${staff.id}`;
  const [session] =
    await sql`insert into sessions(user_id,token_hash,expires_at,revoked_at,created_at) values(${a.id},${sha(crypto.randomUUID())},now()-interval '100 days',now()-interval '100 days',now()-interval '100 days') returning id`;
  expect(
    (
      await staff.api.post("/api/admin/account-holds", {
        data: { userId: a.id, reason: "Preserve synthetic security evidence" },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await staff.api.post("/api/internal/retention/purge", {
        headers: { Authorization: `Bearer ${cron}` },
      })
    ).status(),
  ).toBe(200);
  const rows = await sql`select id from sessions where id=${session.id}`;
  expect(rows).toHaveLength(1);
});

test("concurrent cleanup processes each due request once", async () => {
  const a = await account();
  expect((await close(a)).status()).toBe(200);
  await due(a);
  const responses = await Promise.all([sweep(a.api), sweep(a.api)]);
  for (const r of responses) expect(r.status()).toBe(200);
  const [record] =
    await sql`select count(*)::int n from audit_logs where actor_user_id=${a.id} and action='account.cleanup_completed'`;
  expect(record.n).toBe(1);
});

test("migration preserves user/audit foreign keys and lifecycle request uniqueness", async () => {
  const constraints =
    await sql`select confdeltype from pg_constraint where conrelid='audit_logs'::regclass and confrelid='users'::regclass`;
  expect(constraints).toHaveLength(1);
  expect(constraints[0].confdeltype).toBe("a");
  const a = await account();
  await close(a);
  await expect(
    sql`insert into account_closures(user_id,process_after) values(${a.id},now()+interval '30 days')`,
  ).rejects.toMatchObject({ code: "23505" });
  const [profile] = await sql`select display_name from profiles where user_id=${a.id}`;
  expect(profile.display_name).toBe("Lifecycle Tester");
  const [u] = await sql`select password_hash from users where id=${a.id}`;
  expect(u.password_hash).toBeTruthy();
});
