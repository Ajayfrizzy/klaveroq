import { expect, request, test, type APIRequestContext } from "@playwright/test";
import postgres from "postgres";
import { mkdir } from "node:fs/promises";
const baseURL = "http://127.0.0.1:3199";
const password = "KlaveroqTest123";
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const unique = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
// All browser suites share the loopback IP. Keep fixture registrations from
// exhausting the quota for unrelated tests while retaining limits within a test.
test.beforeEach(async () => {
  await sql`delete from auth_rate_limits where action = 'register'`;
});
test.afterEach(async () => {
  await sql`delete from auth_rate_limits where action = 'register'`;
});
async function account(name: string) {
  const email = `invite-${name.toLowerCase().replace(/[^a-z0-9]/g, "")}-${unique()}@example.test`;
  const api = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  const response = await api.post("/api/auth/register", {
    data: { email, password, displayName: name },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(
    (
      await api.post("/api/auth/verify-email", { data: { token: body.data.verificationToken } })
    ).ok(),
  ).toBeTruthy();
  const cookies = (await api.storageState()).cookies;
  const session = response.headers()["set-cookie"].split(";")[0];
  await api.dispose();
  const authenticated = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL, Cookie: session },
    storageState: { cookies, origins: [] },
  });
  return { api: authenticated, email };
}
async function create(api: APIRequestContext, email: string) {
  const response = await api.post("/api/client-invites", {
    data: {
      email,
      projectTitle: "Website redesign",
      message: "Let’s agree on the project details together.",
    },
  });
  expect(response.status()).toBe(201);
  const { data } = await response.json();
  return { ...data, token: new URL(data.link).searchParams.get("token") };
}
test.afterAll(async () => {
  await sql.end();
});
test("invitation authorization, single use, agreement concurrency and payment isolation", async () => {
  const owner = await account("Freelancer");
  const client = await account("Client");
  const other = await account("Other");
  const invite = await create(owner.api, client.email);
  expect(
    (
      await other.api.post(`/api/client-invites/${invite.id}`, { data: { action: "revoke" } })
    ).status(),
  ).toBe(404);
  expect(
    (
      await other.api.post("/api/client-invites/respond", {
        data: { token: invite.token, action: "accept" },
      })
    ).status(),
  ).toBe(404);
  expect(
    (await owner.api.post("/api/client-invites", { data: { email: client.email } })).status(),
  ).toBe(409);
  const responses = await Promise.all(
    [1, 2].map(() =>
      client.api.post("/api/client-invites/respond", {
        data: { token: invite.token, action: "accept" },
      }),
    ),
  );
  expect(responses.map((r) => r.status()).sort()).toEqual([200, 409]);
  const [stored] = await sql`select * from client_invites where id = ${invite.id}`;
  expect(stored.token_hash).not.toBe(invite.token);
  const quote = await client.api.post("/api/fees/quote", {
    data: { asset: "CKB", subtotal: "10000000000" },
  });
  const payload = {
    clientInviteId: invite.id,
    workerUserId: stored.owner_user_id,
    title: "Client agreement project",
    description: "Design and deliver the complete project website.",
    asset: "CKB",
    assetDecimals: 8,
    feeQuoteId: (await quote.json()).data.id,
    milestones: [
      {
        title: "Website delivery",
        description: "Deliver a responsive website.",
        acceptanceCriteria: "Works on mobile and desktop.",
        amount: "10000000000",
        dueAt: new Date(Date.now() + 86400000).toISOString(),
        evidenceRequirements: "Source and screenshots",
      },
    ],
  };
  const [outsider] = await sql`select id from users where email = ${other.email}`;
  expect(
    (
      await client.api.post("/api/jobs", {
        headers: { "Idempotency-Key": unique() },
        data: { ...payload, workerUserId: outsider.id },
      })
    ).status(),
  ).toBe(403);
  const jobs = await Promise.all(
    [1, 2].map(() =>
      client.api.post("/api/jobs", { headers: { "Idempotency-Key": unique() }, data: payload }),
    ),
  );
  expect(jobs.map((r) => r.status())).toEqual([201, 201]);
  const ids = await Promise.all(jobs.map(async (r) => (await r.json()).data.id));
  expect(ids[0]).toBe(ids[1]);
  expect((await other.api.get(`/api/jobs/${ids[0]}`)).status()).toBe(404);
  const privatePage = await other.api.get(`/jobs/${ids[0]}`);
  expect(await privatePage.text()).not.toContain("Client agreement project");
  expect((await client.api.post(`/api/jobs/${ids[0]}/accept-terms`, { data: {} })).status()).toBe(
    404,
  );
  const accepts = await Promise.all(
    [1, 2].map(() => owner.api.post(`/api/jobs/${ids[0]}/accept-terms`, { data: {} })),
  );
  expect(accepts.map((r) => r.status()).sort()).toEqual([200, 409]);
  const [job] = await sql`select * from jobs where id = ${ids[0]}`;
  expect(job.status).toBe("INVITED");
  expect(job.funded_at).toBeNull();
  expect(job.terms_accepted_at).not.toBeNull();
  expect(job.client_fee).toBe("300000000");
  expect(job.worker_fee_bps).toBe(200);
  const payouts = await sql`select * from job_payout_destinations where job_id = ${ids[0]}`;
  expect(payouts).toHaveLength(0);
  const events = await sql`select action from audit_logs where entity_id = ${invite.id}`;
  expect(events.map((e) => e.action)).toEqual(
    expect.arrayContaining(["client_invite.created", "client_invite.accepted"]),
  );
  await Promise.all([owner.api.dispose(), client.api.dispose(), other.api.dispose()]);
});
test("expiration, resend rotation, decline, revoke, email preferences and quotas", async () => {
  const owner = await account("Lifecycle");
  const client = await account("Recipient");
  const invite = await create(owner.api, client.email);
  await sql`update client_invites set expires_at = now() - interval '1 second' where id = ${invite.id}`;
  expect(
    (
      await client.api.post("/api/client-invites/respond", {
        data: { token: invite.token, action: "accept" },
      })
    ).status(),
  ).toBe(409);
  const resent = await owner.api.post(`/api/client-invites/${invite.id}`, {
    data: { action: "resend" },
  });
  expect(resent.ok()).toBeTruthy();
  const token = new URL((await resent.json()).data.link).searchParams.get("token");
  expect(token).not.toBe(invite.token);
  expect(
    (
      await client.api.post("/api/client-invites/respond", {
        data: { token: invite.token, action: "accept" },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await client.api.post("/api/client-invites/respond", { data: { token, action: "decline" } })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await owner.api.post(`/api/client-invites/${invite.id}`, { data: { action: "resend" } })
    ).status(),
  ).toBe(409);
  const revoked = await create(owner.api, client.email);
  expect(
    (
      await owner.api.post(`/api/client-invites/${revoked.id}`, { data: { action: "revoke" } })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await client.api.post("/api/client-invites/respond", {
        data: { token: revoked.token, action: "accept" },
      })
    ).status(),
  ).toBe(409);
  await sql`insert into notification_preferences (user_id, job_emails) select id, false from users where email = ${client.email} on conflict (user_id) do update set job_emails = false`;
  const suppressed = await create(owner.api, client.email);
  expect(suppressed.emailQueued).toBe(false);
  const [delivery] =
    await sql`select status, text_body from notification_deliveries where token_hash = (select token_hash from client_invites where id = ${suppressed.id})`;
  expect(delivery.status).toBe("SUPPRESSED");
  expect(delivery.text_body).toBe("");
  const history = (await (await owner.api.get("/api/client-invites")).json()).data;
  expect(history.map((i: { status: string }) => i.status)).toEqual(
    expect.arrayContaining(["PENDING", "DECLINED", "REVOKED"]),
  );
  // Fill account quota; recipient-specific failures still consume attempts.
  let status = 0;
  for (let i = 0; i < 21 && status !== 429; i++)
    status = (
      await owner.api.post("/api/client-invites", { data: { email: client.email } })
    ).status();
  expect(status).toBe(429);
  await owner.api.dispose();
  await client.api.dispose();
});
for (const width of [1440, 375])
  test(`new client onboarding and responsive agreement wizard ${width}`, async ({ page }) => {
    const owner = await account(`Designer ${width}`);
    const email = `new-client-${unique()}@example.test`;
    await page.context().addCookies((await owner.api.storageState()).cookies);
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/client-invites");
    await page.getByLabel("Client email").fill(email);
    await page.getByLabel("Project title (optional)").fill("Website redesign");
    await page
      .getByLabel("Personal message (optional)")
      .fill("Let’s plan your new website together.");
    await page.getByRole("button", { name: "Send invitation" }).click();
    const link = page.getByLabel("Invitation link", { exact: true });
    await expect(link).toBeVisible();
    const url = await link.inputValue();
    await mkdir("../../docs/client-invites/screenshots", { recursive: true });
    await page.screenshot({
      path: `../../docs/client-invites/screenshots/history-${width}.png`,
      fullPage: true,
    });
    await page.context().clearCookies();
    await page.goto(url);
    await expect(page.getByText("Let’s plan your new website together.")).toHaveCount(0);
    await page.getByRole("link", { name: "Create account", exact: true }).click();
    await page.getByLabel("Display name").fill("Invited Client");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await page.getByRole("link", { name: "Open local verification link" }).click();
    await page.getByRole("link", { name: "Continue to Klaveroq" }).click();
    await expect(page.getByRole("button", { name: "Accept invitation" })).toBeVisible();
    await page.screenshot({
      path: `../../docs/client-invites/screenshots/review-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(page.getByRole("link", { name: "Create Agreement", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Post Public Job", exact: true })).toBeVisible();
    await page.screenshot({
      path: `../../docs/client-invites/screenshots/accepted-${width}.png`,
      fullPage: true,
    });
    await page.goto("/dashboard");
    await page.getByRole("link", { name: `Create Agreement with Designer ${width}` }).click();
    await expect(
      page.getByRole("heading", { name: "Create Agreement", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Job title")).toHaveValue("Website redesign");
    await page
      .getByLabel("Scope and expected outcome")
      .fill("Design and deliver a responsive website for our business.");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("Amount (CKB)").fill("100");
    await page.getByLabel("Deliverable", { exact: true }).fill("Deliver the complete website.");
    await page.getByLabel("Acceptance criteria").fill("All pages work on mobile and desktop.");
    await page.getByLabel("Due date").fill("2027-01-15");
    await page.getByLabel("Required proof").fill("Website link and source code");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByText(`Designer ${width}`, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Change professional" })).toHaveCount(0);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("checkbox").check();
    await page.screenshot({
      path: `../../docs/client-invites/screenshots/agreement-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Create Agreement", exact: true }).click();
    await expect(page).toHaveURL(/\/jobs\/[a-f0-9-]+$/);
    const jobUrl = page.url();
    await page.context().clearCookies();
    await page.context().addCookies((await owner.api.storageState()).cookies);
    await page.goto(jobUrl);
    await page.getByRole("button", { name: "Accept agreement terms" }).click();
    await expect(
      page.getByText("The freelancer has accepted these terms. No payment was initiated."),
    ).toBeVisible();
    await page.screenshot({
      path: `../../docs/client-invites/screenshots/terms-${width}.png`,
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await owner.api.dispose();
  });

test("existing client login continuation, decline and failed requests stay recoverable", async ({
  page,
}) => {
  const owner = await account("Returning freelancer");
  const client = await account("Returning client");
  const invite = await create(owner.api, client.email);
  await page.goto(invite.link);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(client.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Accept invitation" })).toBeVisible();
  await page.route("**/api/client-invites/respond", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "Temporary failure. Please retry." } }),
    }),
  );
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(page.locator(".client-invites").getByRole("alert")).toContainText(
    "Temporary failure",
  );
  await expect(page.getByRole("button", { name: "Accept invitation" })).toBeEnabled();
  await page.unroute("**/api/client-invites/respond");
  await page.getByRole("button", { name: "Decline invitation" }).click();
  await expect(page.getByRole("status")).toContainText("declined");
  await page.reload();
  await expect(page.getByRole("status")).toContainText("declined");
  expect(
    (
      await owner.api.post("/api/client-invites", {
        headers: { Origin: "https://evil.test" },
        data: { email: client.email },
      })
    ).status(),
  ).toBe(403);
  const anonymous = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  expect(
    (
      await anonymous.post("/api/client-invites/respond", {
        data: { token: invite.token, action: "accept" },
      })
    ).status(),
  ).toBe(401);
  await anonymous.dispose();
  await owner.api.dispose();
  await client.api.dispose();
});
