import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import postgres from "postgres";

const origin = "http://127.0.0.1:3199";
const password = "KlaveroqTest123";
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://klaveroq_test:klaveroq_test@127.0.0.1:55434/klaveroq_test";

async function activateAccount(email: string, role = "USER") {
  const sql = postgres(testDatabaseUrl, { max: 1 });
  await sql`update users
            set email_verified_at = now(), status = 'ACTIVE', system_role = ${role}
            where email = ${email}`;
  await sql.end();
}

async function register(page: Page, email: string, displayName: string, role = "USER") {
  await page.goto("/register");
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/register") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create account" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  await activateAccount(email, role);
  const session = (await response.allHeaders())["set-cookie"]
    ?.split(";")[0]
    .split("=")
    .slice(1)
    .join("=");
  expect(session).toBeTruthy();
  await page.context().addCookies([
    {
      name: "klaveroq_test_session",
      value: session!,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);
}

async function newAccount(context: BrowserContext, email: string, name: string, role = "USER") {
  const page = await context.newPage();
  await register(page, email, name, role);
  return page;
}

test("notification preferences and the complete support lifecycle remain consistent", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const suffix = Date.now();
  const customerEmail = `communications-customer-${suffix}@example.test`;
  const adminEmail = `communications-admin-${suffix}@example.test`;
  const customerContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const customer = await newAccount(customerContext, customerEmail, "Support Customer");
  const admin = await newAccount(adminContext, adminEmail, "Support Agent", "SUPPORT");

  const create = await customer.request.post("/api/support/tickets", {
    headers: { Origin: origin },
    data: {
      category: "GENERAL",
      subject: "Communication lifecycle verification",
      referenceId: "",
      message: "Please verify the complete support reply and notification lifecycle.",
    },
  });
  expect(create.status()).toBe(201);
  const ticket = (await create.json()).data as { id: string; reference: string };

  const unauthorizedAdminView = await customer.request.get(
    `/api/admin/support/tickets/${ticket.id}`,
  );
  expect(unauthorizedAdminView.status()).toBe(403);

  await admin.goto(`/admin/support/${ticket.id}`);
  await admin.getByLabel("Assigned to").selectOption({ label: "Support Agent" });
  await admin.getByLabel("Status").selectOption("IN_PROGRESS");
  await admin.getByLabel("Reply").fill("We reviewed the case and attached the requested notes.");
  await admin.getByLabel("Add attachment").setInputFiles({
    name: "support-notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Support lifecycle evidence."),
  });
  const replyResponse = admin.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/admin/support/tickets/${ticket.id}/messages`) &&
      response.request().method() === "POST",
  );
  await admin.getByRole("button", { name: "Send reply" }).click();
  expect((await replyResponse).status()).toBe(201);

  await customer.goto(`/support/${ticket.id}`);
  await expect(
    customer.getByText("We reviewed the case and attached the requested notes."),
  ).toBeVisible();
  const attachment = customer.getByRole("link", { name: /support-notes\.txt/ });
  await expect(attachment).toBeVisible();
  const attachmentHref = await attachment.getAttribute("href");
  expect(attachmentHref).toBeTruthy();
  expect((await customer.request.get(attachmentHref!)).status()).toBe(200);

  await customer.goto("/notifications");
  const notification = customer
    .locator(".notifications-list article")
    .filter({ hasText: `Support replied to ${ticket.reference}` });
  await expect(notification).toHaveClass(/unread/);
  await notification.getByRole("button", { name: /Mark .* read/ }).click();
  await expect(notification).not.toHaveClass(/unread/);
  await notification.getByRole("button", { name: /Mark .* unread/ }).click();
  await expect(notification).toHaveClass(/unread/);
  await notification.getByRole("link").click();
  await expect(customer).toHaveURL(new RegExp(`/support/${ticket.id}$`));

  const sql = postgres(testDatabaseUrl, { max: 1 });
  const [readState] = await sql<{ read_at: Date | null }[]>`
    select read_at from notifications
    where user_id = (select id from users where email = ${customerEmail})
      and type = 'SUPPORT_REPLIED'
    order by created_at desc limit 1`;
  expect(readState.read_at).not.toBeNull();

  const [retryBaseline] = await sql<{ count: number }[]>`
    select count(*)::int as count from notification_deliveries
    where user_id = (select id from users where email = ${customerEmail})`;
  await sql`
    update notification_deliveries
    set status = 'FAILED', attempts = 1, delivered_at = null,
        next_attempt_at = now() - interval '1 minute'
    where user_id = (select id from users where email = ${customerEmail})`;
  const retryTrigger = await admin.request.post(
    `/api/admin/support/tickets/${ticket.id}/messages`,
    {
      headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
      data: { message: "A second update triggers delivery retry processing.", internal: false },
    },
  );
  expect(retryTrigger.status()).toBe(201);
  const [deliveryState] = await sql<{ total: number; delivered: number }[]>`
    select count(*)::int as total,
           count(*) filter (where status = 'DELIVERED')::int as delivered
    from notification_deliveries
    where user_id = (select id from users where email = ${customerEmail})`;
  expect(deliveryState.total).toBe(retryBaseline.count + 1);
  expect(deliveryState.delivered).toBe(deliveryState.total);

  await customer.goto("/notifications");
  await customer.getByRole("button", { name: "Notification preferences" }).click();
  const supportPreference = customer.getByLabel("Support replies");
  await expect(supportPreference).toBeChecked();
  const preferenceResponse = customer.waitForResponse(
    (response) =>
      response.url().endsWith("/api/notifications/preferences") &&
      response.request().method() === "PUT",
  );
  await supportPreference.uncheck();
  expect((await preferenceResponse).ok()).toBeTruthy();
  await expect(supportPreference).not.toBeChecked();

  const [before] = await sql<{ count: number }[]>`
    select count(*)::int as count from notification_deliveries
    where user_id = (select id from users where email = ${customerEmail})`;
  const replayKey = crypto.randomUUID();
  const firstReplay = await admin.request.post(`/api/admin/support/tickets/${ticket.id}/messages`, {
    headers: { Origin: origin, "Idempotency-Key": replayKey },
    data: {
      message: "This reply is sent once even when the request is replayed.",
      internal: false,
    },
  });
  const secondReplay = await admin.request.post(
    `/api/admin/support/tickets/${ticket.id}/messages`,
    {
      headers: { Origin: origin, "Idempotency-Key": replayKey },
      data: {
        message: "This reply is sent once even when the request is replayed.",
        internal: false,
      },
    },
  );
  expect(firstReplay.status()).toBe(201);
  expect(secondReplay.status()).toBe(200);
  expect((await secondReplay.json()).idempotentReplay).toBe(true);
  const [after] = await sql<{ count: number }[]>`
    select count(*)::int as count from notification_deliveries
    where user_id = (select id from users where email = ${customerEmail})`;
  expect(after.count).toBe(before.count);
  const [messageCount] = await sql<{ count: number }[]>`
    select count(*)::int as count from support_messages
    where ticket_id = ${ticket.id}
      and message = 'This reply is sent once even when the request is replayed.'`;
  expect(messageCount.count).toBe(1);
  await sql.end();

  await customer.goto(`/support/${ticket.id}`);
  await customer.getByRole("button", { name: "Close case" }).click();
  await expect(customer.getByRole("button", { name: "Reopen case" })).toBeVisible();
  await customer.getByRole("button", { name: "Reopen case" }).click();
  await expect(customer.getByRole("button", { name: "Close case" })).toBeVisible();
  await expect(customer.getByLabel("Reply")).toBeVisible();

  await customerContext.close();
  await adminContext.close();
});
