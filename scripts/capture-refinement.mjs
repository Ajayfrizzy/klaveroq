import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// The isolated review server only; never connect this fixture to an owner's account.
const base = "http://127.0.0.1:3199";
const stage = process.argv[2] === "after" ? "after" : "before";
const directory = `docs/ui-refinement/${stage}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext();
const response = await context.request.post(`${base}/api/auth/register`, {
  headers: { Origin: base },
  data: {
    email: `visual-${crypto.randomUUID()}@example.test`,
    password: "KlaveroqTest123",
    displayName: "Beta Review",
  },
});
if (response.status() !== 201) throw new Error(`Fixture registration failed: ${response.status()}`);
const page = await context.newPage();
page.on("pageerror", (error) => console.error("BROWSER ERROR:", error.message));
page.on("console", (message) => {
  if (message.type() === "error") console.error("CONSOLE:", message.text());
});
for (const width of [375, 768, 1440]) {
  await page.setViewportSize({ width, height: 1000 });
  for (const route of [
    "/",
    "/discover",
    "/talent",
    "/jobs",
    "/payments",
    "/activity",
    "/notifications",
    "/wallet",
    "/profile",
    "/support",
  ]) {
    await page.goto(`${base}${route}`);
    await page.locator("h1").first().waitFor();
    await page
      .locator(".sidebar-user strong")
      .filter({ hasText: "Beta Review" })
      .waitFor({ state: "attached" });
    await page.evaluate(() => document.fonts.ready);
    if (["/talent", "/discover"].includes(route)) {
      await page.locator(".discovery-filter-options > summary").click();
      if (route === "/talent") await page.locator(".advanced-filters summary").click();
    }
    await page.screenshot({
      path: `${directory}/${route.slice(1) || "dashboard"}-${width}.png`,
      fullPage: true,
      animations: "disabled",
      caret: "initial",
    });
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      content: document.documentElement.scrollWidth,
    }));
    console.log(route, width, JSON.stringify(dimensions));
    if (dimensions.content > width + 1)
      console.log(
        await page.locator("main *").evaluateAll((elements) =>
          elements
            .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
            .slice(0, 8)
            .map((e) => ({ tag: e.tagName, class: e.className })),
        ),
      );
  }
}
await browser.close();
