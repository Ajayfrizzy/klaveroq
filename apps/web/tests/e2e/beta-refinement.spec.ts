import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = [
  "/dashboard",
  "/discover",
  "/talent",
  "/jobs?view=agreements",
  "/payments",
  "/activity",
  "/notifications",
  "/wallet",
  "/profile",
  "/support",
];

async function reviewAccount(page: Page) {
  const response = await page.request.post("/api/auth/register", {
    headers: { Origin: "http://127.0.0.1:3199" },
    data: {
      email: `beta-${crypto.randomUUID()}@example.test`,
      password: "KlaveroqTest123",
      displayName: "Beta Review",
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).data;
}

async function ready(page: Page, route: string) {
  // Stable no-match searches avoid unrelated marketplace fixtures influencing snapshots.
  await page.goto(
    ["/discover", "/talent"].includes(route) ? `${route}?query=beta-visual-no-match-8d924` : route,
  );
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator(".sidebar-user strong")).toHaveText("Beta Review");
  if (route === "/notifications")
    await expect(page.getByText("You are all caught up")).toBeVisible();
  if (route === "/support") await expect(page.getByText("No support cases yet.")).toBeVisible();
  if (["/discover", "/talent"].includes(route)) {
    await page.locator(".discovery-filter-options > summary").click();
    if (route === "/talent") await page.locator(".advanced-filters summary").click();
  }
}

for (const width of [375, 1440]) {
  test(`main workspace visual references at ${width}px`, async ({ page }) => {
    test.setTimeout(180_000);
    await reviewAccount(page);
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    for (const route of routes) {
      await ready(page, route);
      await expect(page.locator("nextjs-portal")).toHaveCount(0);
      await expect.soft(page).toHaveScreenshot(`${route.split("?")[0].slice(1)}-${width}.png`, {
        fullPage: true,
        animations: "disabled",
        caret: "initial",
        mask: [
          page.locator("time"),
          page.locator(".sidebar-user small"),
          page.locator(".session-description small"),
        ],
        maxDiffPixelRatio: 0.002,
      });
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect.soft(audit.violations, `${route} at ${width}`).toEqual([]);
    }
    expect(errors).toEqual([]);
  });
}

test("expanded filters and workspace reflow at all target widths", async ({ page }) => {
  test.setTimeout(180_000);
  await reviewAccount(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of routes) {
      await ready(page, route);
      expect
        .soft(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${route} at ${width}`,
        )
        .toBe(true);
      if (["/talent", "/discover"].includes(route)) {
        for (const control of await page
          .locator(
            ".discovery-filter-fields input, .discovery-filter-fields select, .filter-actions button",
          )
          .all()) {
          const box = await control.boundingBox();
          expect(box?.height).toBeGreaterThanOrEqual(44);
          expect(box?.height).toBeLessThanOrEqual(48);
        }
      }
    }
  }
  // A 1280px browser at 200% zoom has a 640px CSS layout viewport.
  await page.setViewportSize({ width: 640, height: 500 });
  await ready(page, "/support");
  await expect(page.locator(".work-save-status")).toHaveCount(0);
  await page.getByLabel("Subject", { exact: true }).fill("A long support subject ".repeat(5));
  await expect(page.locator(".work-save-status")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});

test("profile uploads, populated talent and invalid job forms have visual references", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const account = await reviewAccount(page);
  const headers = {
    Origin: "http://127.0.0.1:3199",
    Cookie: (await page.context().storageState()).cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; "),
  };
  expect(
    (
      await page.request.post("/api/auth/verify-email", {
        headers,
        data: { token: account.verificationToken },
      })
    ).ok(),
  ).toBe(true);
  const role = `Visual-${crypto.randomUUID()}`;
  expect(
    (
      await page.request.patch("/api/profile", {
        headers,
        data: {
          displayName: "Beta Review",
          headline: "Accessible product design for complex marketplaces",
          primaryRole: role,
          bio: "I turn complex marketplace workflows into accessible, understandable experiences with clear milestones and practical delivery evidence.",
          skills: ["Design", "Accessibility"],
          experienceLevel: "EXPERT",
          countryCode: "NG",
          timezone: "Africa/Lagos",
          availability: "AVAILABLE",
        },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await page.request.patch("/api/profile/visibility", { headers, data: { isPublic: true } })
    ).ok(),
  ).toBe(true);
  const viewerContext = await browser.newContext();
  const viewer = await viewerContext.newPage();
  await reviewAccount(viewer);
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await viewer.setViewportSize({ width, height: 1000 });
    await viewer.goto(`/talent?role=${role}`);
    await expect(viewer.locator(".talent-card")).toBeVisible();
    await expect(viewer.locator(".talent-card")).toHaveCount(1);
    await expect(viewer.locator(".sidebar-user strong")).toHaveText("Beta Review");
    await expect.soft(viewer).toHaveScreenshot(`talent-populated-${width}.png`, {
      fullPage: true,
      caret: "initial",
      mask: [viewer.locator(".sidebar-user small"), viewer.locator(".filter-chip")],
      maxDiffPixelRatio: 0.002,
    });
    await page.goto("/profile");
    await page.getByRole("button", { name: "Edit profile", exact: true }).click();
    await page.getByLabel("Primary role", { exact: true }).fill("Product designer");
    const photo = page.locator(".profile-media-control");
    await photo.locator('input[type="file"]').setInputFiles({
      name: "preview.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMioAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await expect(
      page.locator(".profile-avatar").getByAltText("Selected profile photo preview"),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.soft(page).toHaveScreenshot(`profile-editing-${width}.png`, {
      fullPage: true,
      caret: "initial",
      mask: [page.locator(".sidebar-user small")],
      maxDiffPixelRatio: 0.002,
    });
    await page.getByRole("button", { name: "Save profile", exact: true }).click();
    await expect(page.getByText("Profile saved.", { exact: true })).toBeVisible();
    // Restore only this fixture's unique search role for the next viewport.
    expect(
      (await page.request.patch("/api/profile", { headers, data: { primaryRole: role } })).ok(),
    ).toBe(true);
    await page.goto("/jobs/new/direct");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByLabel("Job title", { exact: false })).toBeFocused();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.soft(page).toHaveScreenshot(`job-validation-${width}.png`, {
      fullPage: true,
      caret: "initial",
      mask: [page.locator(".sidebar-user small")],
      maxDiffPixelRatio: 0.002,
    });
  }
  await viewerContext.close();
});
