import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { sessionRequest } from "./preference-test-session";

// Intentionally uses real PostgreSQL locks/timeouts, never application fault-injection switches.
// Run only with playwright.dashboard.config.ts and a NEW disposable database configured
// with statement_timeout=750ms (see the reliability runbook).
const databaseUrl = process.env.TEST_DATABASE_URL;
if (
  !databaseUrl ||
  !["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname) ||
  !new URL(databaseUrl).pathname.endsWith("_test")
)
  throw new Error("Isolated loopback test database required");
const sql = postgres(databaseUrl, { max: 10 });
test.beforeAll(async () => {
  const [settings] =
    await sql`select setting::int as timeout from pg_settings where name = 'statement_timeout'`;
  if (!(settings.timeout > 0 && settings.timeout <= 5000))
    throw new Error(
      "Use a dedicated test database with a short statement_timeout; do not change beta settings.",
    );
});
test.afterAll(async () => {
  await sql.end();
});
async function register(page: Page) {
  await sql`delete from auth_rate_limits where action = 'register'`;
  const response = await sessionRequest(page.request).post("/api/auth/register", {
    headers: { Origin: "http://127.0.0.1:3201" },
    data: {
      email: `dashboard-fault-${crypto.randomUUID()}@example.test`,
      password: "KlaveroqTest123",
      displayName: "Recovery Tester",
    },
  });
  expect(response.status()).toBe(201);
}
async function lock(table: "audit_logs" | "wallets" | "sessions" | "jobs" | "operations") {
  const connection = await sql.reserve();
  try {
    await connection`begin`;
    await connection`set local statement_timeout = '5s'`;
    // Identifier comes only from this fixed test allowlist.
    await connection.unsafe(`lock table ${table} in access exclusive mode`);
  } catch (error) {
    await connection`rollback`;
    connection.release();
    throw error;
  }
  let released = false;
  return async () => {
    if (!released) {
      released = true;
      await connection`rollback`;
      connection.release();
    }
  };
}

test("a real optional activity timeout leaves dashboard and health checks usable, then Retry recovers", async ({
  page,
}) => {
  await register(page);
  const release = await lock("audit_logs");
  try {
    const response = await page.goto("/");
    expect(response?.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "Welcome, Recovery" })).toBeVisible();
    await expect(
      page.getByText("Recent activity is temporarily unavailable.", { exact: false }),
    ).toBeVisible();
    expect((await page.request.get("/api/health/live")).status()).toBe(200);
    expect((await page.request.get("/api/health/ready")).status()).toBe(200);
    await release();
    await page.getByRole("button", { name: "Retry recent activity" }).click();
    await expect(
      page.getByText("Recent activity is temporarily unavailable.", { exact: false }),
    ).toHaveCount(0);
    await expect(page.locator(".activity-row").first()).toBeVisible();
  } finally {
    await release();
  }
});

test("a verification timeout is unknown, not pending or verified", async ({ page }) => {
  await register(page);
  const release = await lock("wallets");
  try {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Welcome, Recovery" })).toBeVisible();
    await expect(
      page.getByText("Verification status is temporarily unavailable.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByText("Wallet pending", { exact: true })).toHaveCount(0);
  } finally {
    await release();
  }
});

for (const table of ["sessions", "jobs"] as const) {
  test(`critical ${table} timeout reaches the error boundary and its Retry refetches successfully`, async ({
    page,
  }) => {
    await register(page);
    const release = await lock(table);
    try {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "We couldn’t load this page" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Welcome, Recovery" })).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText("select ");
      await expect(page.locator("body")).not.toContainText("postgresql://");
      expect((await page.request.get("/api/health/ready")).status()).toBe(200);
      await release();
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Welcome, Recovery" })).toBeVisible();
    } finally {
      await release();
    }
  });
}

test("unavailable unused financial queries do not run or invent balances on the dashboard", async ({
  page,
}) => {
  await register(page);
  const release = await lock("operations");
  try {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Welcome, Recovery" })).toBeVisible();
    await expect(
      page.getByText("Payment integration is not connected.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByText("0 CKB", { exact: true })).toHaveCount(0);
  } finally {
    await release();
  }
});

test("sixteen concurrent reads queue successfully behind a ten-connection pool", async () => {
  const results = await Promise.all(
    Array.from({ length: 16 }, () => sql`select pg_backend_pid() as pid, pg_sleep(0.02)`),
  );
  expect(results).toHaveLength(16);
  expect(new Set(results.map(([row]) => row.pid)).size).toBeLessThanOrEqual(10);
});

test("workspace recommendation failure stays local and its Retry recovers", async ({ page }) => {
  await register(page);
  let unavailable = true;
  await page.route("**/api/preferences", async (route) => {
    if (unavailable)
      await route.fulfill({ status: 503, json: { error: { message: "Temporarily unavailable" } } });
    else await route.continue();
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome, Recovery" })).toBeVisible();
  await expect(
    page.getByText("Workspace recommendations are temporarily unavailable."),
  ).toBeVisible();
  unavailable = false;
  await page.getByRole("button", { name: "Retry loading preferences" }).click();
  await expect(page.getByRole("heading", { name: "What would you like to do?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hire talent", exact: true })).toBeEnabled();
});
