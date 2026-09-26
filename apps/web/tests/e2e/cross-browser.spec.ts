import { expect, test } from "@playwright/test";

test("public discovery and authentication render in supported desktop engines", async ({
  page,
}) => {
  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: /Find work/i })).toBeVisible();
  await expect(page.getByLabel("Category")).toBeEnabled();
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeEditable();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
});
