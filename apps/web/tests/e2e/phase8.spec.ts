import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const password = "KlaveroqTest123";
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://klaveroq_test:klaveroq_test@127.0.0.1:55434/klaveroq_test";

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
  expect((await responsePromise).status()).toBe(201);

  const sql = postgres(testDatabaseUrl, { max: 1 });
  await sql`update users
            set email_verified_at = now(), status = 'ACTIVE', system_role = ${role}
            where email = ${email}`;
  await sql.end();
}

test("super administrators can reach both operations workspaces", async ({ page }) => {
  await register(
    page,
    `phase8-super-${Date.now()}@example.test`,
    "Release Administrator",
    "SUPER_ADMIN",
  );
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Support queue", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Disputes", exact: true })).toBeVisible();

  await page.goto("/admin/disputes");
  await expect(page.getByRole("heading", { name: "Dispute queue" })).toBeVisible();
});

test("permission denial is explicit and an expired session returns to sign in", async ({
  page,
}) => {
  const email = `phase8-user-${Date.now()}@example.test`;
  await register(page, email, "Release User");

  await page.goto("/admin/support");
  await expect(page).toHaveURL(/\/admin\/login\?unauthorized=1$/);
  await expect(page.locator(".form-errors[role=alert]")).toContainText("does not have permission");

  const sql = postgres(testDatabaseUrl, { max: 1 });
  await sql`update sessions
            set expires_at = now() - interval '1 minute'
            where user_id = (select id from users where email = ${email})`;
  await sql.end();

  await page.goto("/jobs");
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("notifications expose loading and recoverable error states", async ({ page }) => {
  let releaseResponse: (() => void) | undefined;
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await page.route("**/api/notifications", async (route) => {
    await responseGate;
    await route.fulfill({
      status: 503,
      json: { error: { message: "Notifications are temporarily unavailable." } },
    });
  });

  await page.goto("/notifications");
  await expect(page.getByLabel("Loading notifications")).toBeVisible();
  releaseResponse?.();
  const error = page.locator(".form-feedback[role=alert]");
  await expect(error).toContainText("temporarily unavailable");
  await expect(error).toContainText("Try refreshing the page");
});

test("long notification content reflows on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route("**/api/notifications", (route) =>
    route.fulfill({
      status: 200,
      json: {
        data: [
          {
            id: crypto.randomUUID(),
            title: `Reference-${"A".repeat(120)}`,
            body: `Status-${"B".repeat(320)}`,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    }),
  );
  await page.goto("/notifications");
  await expect(page.getByText(/Reference-A+/)).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
});
