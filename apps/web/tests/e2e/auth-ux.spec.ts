import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const email = "new-member@example.test";
const destination = "/client-invites/review-invitation";
const screenshotDir = path.resolve(process.cwd(), "../../docs/screenshots/m1-auth");

for (const viewport of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name}: registration handoff, password guidance, resend and keyboard access`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.route("**/api/auth/register", (route) => {
      expect(route.request().postDataJSON()).toMatchObject({ email, returnTo: destination });
      return route.fulfill({ json: { data: { emailSent: true } } });
    });
    await page.goto(`/register?returnTo=${encodeURIComponent(destination)}`);
    await expect(page.getByText("Use at least 12 characters", { exact: false })).toBeVisible();
    await page.getByLabel("Display name").fill("New Member");
    await page.getByLabel("Email", { exact: true }).fill(email);
    const password = page.getByLabel("Password", { exact: true });
    await expect(password).toHaveAttribute("aria-describedby", "password-guidance");
    await password.fill("short");
    expect(await password.evaluate((node: HTMLInputElement) => node.checkValidity())).toBe(false);
    await password.fill("lowercaseonly123");
    expect(await password.evaluate((node: HTMLInputElement) => node.checkValidity())).toBe(false);
    await password.fill("StrongPassword123");
    await expect(page.getByRole("status")).toHaveText("Minimum length met.");
    await password.press("Tab");
    await expect(page.getByRole("button", { name: "Show password" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(password).toHaveAttribute("type", "text");
    await page.keyboard.press("Enter");
    await expect(password).toHaveAttribute("type", "password");
    await mkdir(screenshotDir, { recursive: true });
    await page.screenshot({
      path: path.join(screenshotDir, `${viewport.name}-registration.png`),
      fullPage: true,
    });
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText("A verification link has been sent");
    await expect(page.getByText(/Check your spam folder/)).toBeVisible();
    const resend = page.getByRole("button", { name: "Resend verification email" });
    await expect(resend).toHaveClass("secondary-button");
    await page.screenshot({
      path: path.join(screenshotDir, `${viewport.name}-check-email.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
    await page.route("**/api/auth/verify-email/resend", (route) => {
      expect(route.request().postDataJSON()).toEqual({ email, returnTo: destination });
      return route.fulfill({ json: { data: { accepted: true, emailSent: true } } });
    });
    await resend.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toContainText("A new verification link has been sent");
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      `/login?returnTo=${encodeURIComponent(destination)}`,
    );
  });
}

test("failed registration delivery remains retryable through provider and network failures", async ({
  page,
}) => {
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({ json: { data: { emailSent: false } } }),
  );
  await page.goto("/register");
  await page.getByLabel("Display name").fill("Retry Member");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("StrongPassword123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText("email could not be sent");
  let attempts = 0;
  await page.route("**/api/auth/verify-email/resend", (route) => {
    attempts++;
    if (attempts === 2) return route.abort();
    return route.fulfill({ json: { data: { accepted: true, emailSent: attempts > 2 } } });
  });
  await page.getByRole("button", { name: "Retry verification email" }).click();
  await expect(page.getByRole("status")).toContainText("could not be sent");
  await page.getByRole("button", { name: "Retry verification email" }).click();
  await expect(page.getByRole("button", { name: "Retry verification email" })).toBeEnabled();
  await page.getByRole("button", { name: "Retry verification email" }).click();
  await expect(page.getByRole("status")).toContainText("A new verification link has been sent");
});

test("verification errors allow an address and retry without claiming delivery", async ({
  page,
}) => {
  await page.route("**/api/auth/verify-email", (route) =>
    route.fulfill({
      status: 400,
      json: { error: { message: "The verification link is invalid or expired." } },
    }),
  );
  await page.goto(`/verify-email?token=invalid-token&returnTo=${encodeURIComponent(destination)}`);
  await expect(page.getByRole("status")).toHaveText("The verification link is invalid or expired.");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.route("**/api/auth/verify-email/resend", (route) =>
    route.fulfill({ json: { data: { accepted: true } } }),
  );
  await page.getByRole("button", { name: "Retry verification email" }).click();
  await expect(page.getByRole("status")).toContainText("Request received.");
  await expect(page.getByRole("status")).not.toContainText("has been sent");
});

test("verification success preserves invitation continuation", async ({ page }) => {
  await page.route("**/api/auth/verify-email", (route) =>
    route.fulfill({ json: { data: { verified: true } } }),
  );
  await page.goto(`/verify-email?token=valid-token&returnTo=${encodeURIComponent(destination)}`);
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue to Klaveroq" })).toHaveAttribute(
    "href",
    destination,
  );
});

test("password reset guidance and validation match registration", async ({ page }) => {
  await page.goto("/reset-password?token=test-token");
  await expect(page.getByText("Use at least 12 characters", { exact: false })).toBeVisible();
  const password = page.getByLabel("New password", { exact: true });
  await password.fill("alllowercase123");
  expect(await password.evaluate((node: HTMLInputElement) => node.checkValidity())).toBe(false);
  await password.fill("StrongPassword123");
  await expect(page.getByRole("status")).toHaveText("Minimum length met.");
  await page.getByLabel("Confirm new password").fill("DifferentPassword123");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("The passwords do not match.");
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
});
