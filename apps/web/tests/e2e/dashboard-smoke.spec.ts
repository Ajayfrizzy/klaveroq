import { expect, test } from "@playwright/test";
import { sessionRequest } from "./preference-test-session";

test("authenticated dashboard smoke: renders and survives an RSC navigation and reload", async ({
  page,
}) => {
  const origin = "http://127.0.0.1:3201";
  const api = sessionRequest(page.request);
  const response = await api.post("/api/auth/register", {
    headers: { Origin: origin },
    data: {
      email: `dashboard-${crypto.randomUUID()}@example.test`,
      password: "KlaveroqTest123",
      displayName: "Dashboard Tester",
    },
  });
  expect(response.status()).toBe(201);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const dashboard = await page.goto("/dashboard");
  expect(dashboard?.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Welcome, Dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent activity", exact: true })).toBeVisible();
  await expect(
    page.locator(".network-card").getByText("Payment network not connected", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View all", exact: true }).click();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome, Dashboard" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Welcome, Dashboard" })).toBeVisible();
  expect(errors).toEqual([]);
});
