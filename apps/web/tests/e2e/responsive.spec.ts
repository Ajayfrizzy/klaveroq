import { expect, test } from "@playwright/test";

test("public marketplace remains usable at a mobile viewport", async ({ page }) => {
  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: /Find work/i })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  await expect(page.getByRole("link", { name: /Klaveroq/i }).first()).toBeVisible();
});

test("professional profile sections remain usable at a mobile viewport", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("clean-profile@example.test");
  await page.getByLabel("Password").fill("KlaveroqTest123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Skills" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Location" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
});
