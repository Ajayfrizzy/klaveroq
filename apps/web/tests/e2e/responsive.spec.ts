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
