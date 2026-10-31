import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const policies = [
  ["terms", "Terms of Service"],
  ["privacy", "Privacy Policy"],
  ["account-deletion", "Account Deletion & Recovery"],
  ["community-guidelines", "Community Guidelines"],
  ["cookies", "Cookies & Browser Storage"],
  ["payments", "Payments, Escrow & Refunds"],
];
for (const width of [375, 390, 1280]) {
  test(`public policy routes, metadata, anchors and accessibility at ${width}px`, async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    // A stale session must not make public legal documents depend on account lookup.
    await context.addCookies([
      {
        name: "klaveroq_test_session",
        value: "expired-test-session",
        url: "http://127.0.0.1:3199",
      },
    ]);
    const screenshots = path.resolve("../../docs/legal/screenshots");
    await mkdir(screenshots, { recursive: true });
    await page.goto("/legal");
    await expect(page).toHaveTitle("Legal & policies — Draft | Klaveroq");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Legal & policies");
    const cards = page.getByRole("navigation", { name: "Policy documents", exact: true });
    await expect(cards.getByRole("link")).toHaveCount(6);
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: path.join(screenshots, `hub-${width}.png`), fullPage: true });
    await cards.getByRole("link", { name: /Terms of Service/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/legal\/terms$/);
    for (const [slug, title] of policies) {
      const response = await page.goto(`/legal/${slug}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page).toHaveTitle(`${title} — Draft | Klaveroq`);
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        "content",
        `${title} — Draft`,
      );
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `http://127.0.0.1:3199/legal/${slug}`,
      );
      const notice = page.getByRole("complementary", { name: "Draft status" });
      await expect(notice).toContainText("Draft — not yet effective");
      await expect(notice).toContainText("0.1-draft");
      await expect(notice).toContainText("No effective date");
      await expect(notice.locator("time")).toHaveAttribute("datetime", "2026-10-31");
      const toc = page.getByRole("navigation", { name: "On this page" });
      for (const link of await toc.getByRole("link").all()) {
        const href = await link.getAttribute("href");
        await expect(page.locator(href!)).toHaveCount(1);
      }
      const last = toc.getByRole("link").last();
      const anchor = await last.getAttribute("href");
      await last.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(anchor!)).toBeInViewport();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      expect(
        (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
          .violations,
      ).toEqual([]);
      if (["account-deletion", "payments"].includes(slug)) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: path.join(screenshots, `${slug}-${width}.png`),
          fullPage: true,
        });
      }
    }
    await expect(page.getByRole("article")).toContainText(
      "Real payments, escrow funding, refunds and settlement are not yet operational",
    );
    await expect(page.getByRole("article")).toContainText("not binding payment terms");
    // Next returns 200 for a streamed notFound response; assert the actual boundary.
    await page.goto("/legal/not-a-policy");
    await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(0);
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toHaveAttribute(
      "content",
      /noindex/,
    );
  });
}

test("footer, registration and account routes expose drafts without mandatory consent", async ({
  page,
}) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "Legal & policies", exact: true })).toHaveAttribute(
    "href",
    "/legal",
  );
  for (const [slug, title] of policies) {
    await expect(footer.getByRole("link", { name: title, exact: true })).toHaveAttribute(
      "href",
      `/legal/${slug}`,
    );
  }
  await page.goto("/register?returnTo=/client-invites/respond");
  await expect(
    page.getByRole("navigation", { name: "Policy drafts" }).getByRole("link"),
  ).toHaveCount(3);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(
    page.getByText("registration does not record acceptance", { exact: false }),
  ).toBeVisible();
  const email = `legal-${crypto.randomUUID()}@example.test`;
  await page.getByLabel("Display name", { exact: true }).fill("Policy Review");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("KlaveroqTest123");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page).toHaveURL(/returnTo=%2Fclient-invites%2Frespond/);
  await page.goto("/account/settings");
  await expect(page.getByRole("heading", { name: "Delete account" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Account Deletion & Recovery (draft)" }),
  ).toHaveAttribute("href", "/legal/account-deletion");
  await expect(page.getByRole("link", { name: "Privacy Policy (draft)" })).toBeVisible();
  await page.goto("/support");
  await expect(
    page.getByRole("navigation", { name: "Support policy drafts" }).getByRole("link"),
  ).toHaveCount(3);
  await page.context().clearCookies();
  for (const route of ["/account/privacy", "/account/recover"]) {
    await page.goto(route);
    await expect(page.getByRole("link", { name: "Privacy Policy (draft)" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Account Deletion & Recovery (draft)" }),
    ).toBeVisible();
  }
});
