import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const route of ["/login", "/discover", "/talent"]) {
  test(`${route} has no serious WCAG A/AA violations`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      ),
    ).toEqual([]);
  });
}

test("keyboard users can skip navigation and see focus", async ({ page }) => {
  await page.goto("/login");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus-visible")).toBeVisible();
});

test("content reflows at 200 percent zoom without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto("/discover");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test("reduced-motion preference suppresses meaningful animation and transitions", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
    true,
  );
  const durations = await page.getByRole("button", { name: "Sign in" }).evaluate((element) => {
    const style = getComputedStyle(element);
    const seconds = (value: string) =>
      Math.max(...value.split(",").map((duration) => Number.parseFloat(duration)));
    return {
      animation: seconds(style.animationDuration),
      transition: seconds(style.transitionDuration),
    };
  });
  expect(durations.animation).toBeLessThanOrEqual(0.00001);
  expect(durations.transition).toBeLessThanOrEqual(0.00001);
});
