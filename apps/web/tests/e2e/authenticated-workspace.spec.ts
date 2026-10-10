import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import postgres from "postgres";
import { sessionRequest } from "./preference-test-session";

const origin = "http://127.0.0.1:3201";
const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://klaveroq_test:klaveroq_test@127.0.0.1:55434/klaveroq_test";
async function account(page: Page, displayName: string) {
  const sql = postgres(databaseUrl, { max: 1 });
  await sql`delete from auth_rate_limits where action = 'register'`;
  const response = await sessionRequest(page.request).post("/api/auth/register", {
    headers: { Origin: origin },
    data: {
      email: `workspace-${crypto.randomUUID()}@example.test`,
      password: "KlaveroqTest123",
      displayName,
    },
  });
  expect(response.status()).toBe(201);
  const id = (await response.json()).data.user.id;
  await sql`update users set email_verified_at = now(), status = 'ACTIVE' where id = ${id}`;
  await sql.end();
  expect(
    (
      await sessionRequest(page.request).patch("/api/profile", {
        headers: { Origin: origin },
        data: {
          displayName,
          headline: "Product design and accessible service experiences",
          bio: "I work on practical digital experiences with clear milestones, accessible interactions, and documented delivery expectations.",
        },
      })
    ).ok(),
  ).toBe(true);
}
async function capture(page: Page, name: string) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: test.info().outputPath(`${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}
async function audit(page: Page) {
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
}
async function reflow(page: Page, name: string) {
  await expect(page.locator(".page-skeleton")).toHaveCount(0);
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator(".sidebar-user strong")).not.toBeEmpty();
  for (const width of [320, 375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect
      .soft(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${name} ${width}px`,
      )
      .toBe(true);
    if (name === "job-creation") {
      const steps = await page
        .locator(".listing-steps > li")
        .evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top));
      expect(new Set(steps).size).toBe(1);
      if (width <= 760)
        expect(
          (await page.getByRole("button", { name: "Continue", exact: true }).boundingBox())!.width,
        ).toBeGreaterThan(120);
    }
    if ([375, 768, 1440].includes(width)) await capture(page, `${name}-${width}`);
  }
}

test("authenticated screens reflow, preserve privacy and expose keyboard navigation", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await account(page, "Amara Okafor");
  for (const [name, route] of Object.entries({
    dashboard: "/dashboard",
    discovery: "/discover",
    profile: "/profile",
    wallet: "/wallet",
    payments: "/payments",
    activity: "/activity",
    support: "/support",
  })) {
    await page.goto(route);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator(".sidebar-user strong")).toContainText("Amara Okafor");
    await reflow(page, name);
    await audit(page);
    if (name === "profile") {
      await expect(page.getByText("Private profile", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Edit profile", exact: true }).click();
      await reflow(page, "profile-edit");
      await audit(page);
      await page.getByLabel("Display name").fill("Amara Okafor · Product designer");
      await page.getByRole("button", { name: "Save profile", exact: true }).click();
      await expect(page.getByText("Private profile saved.", { exact: true })).toBeVisible();
    }
  }
  await page.setViewportSize({ width: 375, height: 812 });
  const menu = page.getByRole("button", { name: "Open menu" });
  await menu.click();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
});

test("job and proposal editors preserve collapsed fields through review and submission", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  await account(page, "Ada Studio");
  await page.goto("/jobs/new/public");
  await page.getByLabel("Job title").fill("Design an accessible booking experience");
  await page
    .getByLabel("Scope and expected outcome")
    .fill(
      "Design a clear booking journey for an independent studio, with accessible mobile layouts and a documented handoff.",
    );
  await page.getByLabel("Category").selectOption("DESIGN");
  await page.getByLabel("Skills").fill("Product design, Accessibility");
  await reflow(page, "job-creation");
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByLabel("Milestone title").fill("Booking prototype");
  await page
    .getByLabel("What will be delivered?")
    .fill("An interactive prototype of the full booking journey.");
  await page
    .getByLabel("How will success be confirmed?")
    .fill("The complete booking journey is keyboard accessible.");
  await page
    .getByLabel("What proof should be provided?")
    .fill("Prototype link and accessibility notes");
  await page.locator(".milestone-disclosure > summary").click();
  await expect(page.getByLabel("Milestone title")).not.toBeVisible();
  await reflow(page, "job-milestones");
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByLabel("Minimum budget (CKB)").fill("100");
  await page.getByLabel("Maximum budget (CKB)").fill("200");
  await page
    .getByLabel("Proposal deadline")
    .fill(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Review job" }).click();
  await reflow(page, "job-review");
  await audit(page);
  await page.getByRole("button", { name: "Publish job" }).click();
  await expect(page).toHaveURL(/\/discover\//);
  const listingUrl = page.url();
  const workerContext = await browser.newContext();
  const worker = await workerContext.newPage();
  await account(worker, "Tomi Adeyemi");
  await worker.goto("/discover?query=booking");
  await expect(worker.locator(".listing-card").first()).toBeVisible();
  await reflow(worker, "discovery-populated");
  await audit(worker);
  await worker.goto(listingUrl);
  await reflow(worker, "job-detail");
  await worker.getByRole("link", { name: "Write a proposal" }).click();
  await worker
    .getByLabel("Cover letter")
    .fill(
      "I will design a focused booking journey with accessible interactions and a practical handoff for your studio.",
    );
  await worker.getByLabel("Milestone title").fill("Prototype and handoff");
  await worker
    .getByLabel("What will you deliver?")
    .fill("An accessible booking prototype and implementation notes.");
  await worker
    .getByLabel("How will success be confirmed?")
    .fill("Booking can be completed with keyboard navigation.");
  await worker.getByLabel("Milestone amount").fill("150");
  await worker
    .getByLabel("What proof will you provide?")
    .fill("Prototype URL and accessibility review");
  await worker.getByRole("button", { name: /Add milestone/ }).click();
  const second = worker.locator(".milestone-disclosure").nth(1);
  await second.getByLabel("Milestone title").fill("Follow-up");
  await expect(second.getByLabel("Milestone title")).toBeVisible();
  await worker.getByRole("button", { name: "Remove milestone 2" }).click();
  await reflow(worker, "proposal");
  await audit(worker);
  // Invalid fields inside a closed milestone must be revealed and focused.
  await worker.getByLabel("Milestone title").fill("");
  await worker.locator(".milestone-disclosure > summary").click();
  await worker.getByRole("button", { name: /Review proposal/ }).click();
  await expect(worker.getByLabel("Milestone title")).toBeFocused();
  await worker.getByLabel("Milestone title").fill("Prototype and handoff");
  await worker.locator(".milestone-disclosure > summary").click();
  await worker.getByRole("button", { name: /Review proposal/ }).click();
  await expect(worker.getByRole("heading", { name: "Review your proposal" })).toBeFocused();
  await reflow(worker, "proposal-review");
  await worker.getByRole("button", { name: "Confirm and submit" }).click();
  await expect(worker.getByRole("button", { name: "Confirm update" })).toBeVisible();
  await workerContext.close();
});

test("wallet message stays exact while payload and signature fields are progressively disclosed", async ({
  page,
}) => {
  await account(page, "Wallet Review");
  const message = "Klaveroq wallet verification\nExact signing payload\nnonce: isolated-ui-fixture";
  await page.route("**/api/wallets/challenge", (route) =>
    route.fulfill({
      json: {
        data: {
          id: "ui-fixture",
          message,
          nonce: "isolated-ui-fixture",
          expiresAt: new Date(Date.now() + 600000).toISOString(),
        },
      },
    }),
  );
  await page.goto("/wallet");
  await page.getByLabel("Wallet address").fill("ckb-isolated-interface-test-address");
  await page.getByRole("button", { name: "Create signing message" }).click();
  await expect(page.getByRole("button", { name: "Copy message" })).toBeVisible();
  await expect(page.getByLabel("Message to sign", { exact: true })).not.toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          document.documentElement.dataset.copiedMessage = value;
        },
      },
    }),
  );
  await page.getByRole("button", { name: "Copy message" }).click();
  expect(await page.evaluate(() => document.documentElement.dataset.copiedMessage)).toBe(message);
  await expect(page.getByRole("status")).toContainText("Message copied");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    }),
  );
  await page.getByRole("button", { name: "Copy message" }).click();
  await expect(page.getByRole("status")).toContainText("Copy unavailable");
  await page.getByText("View message to sign", { exact: true }).click();
  await expect(page.getByLabel("Message to sign", { exact: true })).toHaveValue(message);
  await page.getByRole("button", { name: "Verify ownership" }).click();
  await expect(page.getByLabel("Signature", { exact: true })).toBeVisible();
  await reflow(page, "wallet-signing");
  await audit(page);
});

test("direct agreement milestone disclosure reveals invalid fields and keeps edits", async ({
  page,
}) => {
  await account(page, "Direct Agreement Review");
  await page.goto("/jobs/new/direct");
  await page.getByLabel("Job title", { exact: false }).fill("Design the studio booking page");
  await page
    .getByLabel("Scope", { exact: false })
    .fill("Create an accessible booking experience for an independent studio.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Milestone title").fill("Booking page");
  await page.locator(".milestone-disclosure > summary").click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator('.milestone-disclosure [aria-invalid="true"]').first()).toBeFocused();
  await expect(page.getByLabel("Milestone title")).toHaveValue("Booking page");
  await reflow(page, "direct-agreement-milestone");
});

test("published profile and portfolio display saved professional details without invented reputation", async ({
  page,
}) => {
  test.setTimeout(60000);
  await account(page, "Tomi Adeyemi");
  const headers = { Origin: origin };
  expect(
    (
      await sessionRequest(page.request).patch("/api/profile", {
        headers,
        data: {
          displayName: "Tomi Adeyemi",
          headline: "Accessible product design for independent businesses",
          primaryRole: "Product designer",
          bio: "I design practical booking and service experiences with accessible interactions, clear delivery milestones, and a documented handoff.",
          skills: ["Product design", "Accessibility"],
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
      await sessionRequest(page.request).post("/api/profile/portfolio", {
        headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
        data: {
          title: "Independent studio booking concept",
          description:
            "A concept booking journey exploring clear service selection, accessible scheduling and confirmation screens.",
          projectRole: "Product designer",
          skills: ["Product design", "Accessibility"],
          projectUrl: "https://example.com/studio-concept",
          githubUrl: null,
        },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await sessionRequest(page.request).patch("/api/profile/visibility", {
        headers,
        data: { isPublic: true },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/profile");
  await expect(page.getByText("Public profile", { exact: true })).toBeVisible();
  await expect(page.getByText("No verified reviews yet", { exact: true })).toBeVisible();
  await reflow(page, "profile-published");
  await audit(page);
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await reflow(page, "profile-edit-populated");
});

test("support ticket and reply remain usable with attachments disabled", async ({ page }) => {
  test.setTimeout(60000);
  await account(page, "Support Review");
  await page.goto("/support");
  await page.getByLabel("Subject", { exact: true }).fill("Clarify a delivery milestone");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Where can I review the acceptance criteria before sharing my delivery proof?");
  await page.getByRole("button", { name: "Submit case" }).click();
  await page.getByRole("link", { name: /Clarify a delivery milestone/ }).click();
  await expect(page).toHaveURL(/\/support\//);
  await page
    .getByLabel("Reply", { exact: true })
    .fill("I found the milestone description and would like to confirm the next step.");
  await expect(page.locator('input[type="file"]')).toBeDisabled();
  await reflow(page, "support-conversation");
  await audit(page);
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.locator(".message-bubble")).toHaveCount(2);
});
