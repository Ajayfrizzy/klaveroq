import { expect, test, type Page, type Locator } from "@playwright/test";
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
async function focusIsExposed(field: Locator) {
  await expect(field).toBeFocused();
  expect(
    await field.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top >= 88 && rect.bottom <= innerHeight - 80;
    }),
  ).toBe(true);
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
    if (name === "proposal-review" && width <= 430) {
      const confirm = await page.getByRole("button", { name: "Confirm and submit" }).boundingBox();
      expect(confirm!.height).toBeLessThanOrEqual(64);
      expect(confirm!.height).toBeGreaterThanOrEqual(44);
    }
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
    if ([375, 430, 768, 1440].includes(width)) await capture(page, `${name}-${width}`);
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
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByLabel("Milestone title").fill("Booking prototype");
  await page.locator(".milestone-disclosure > summary").click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await focusIsExposed(page.getByLabel("What will be delivered?"));
  await expect(page.getByLabel("Milestone title")).toHaveValue("Booking prototype");
  // The same error must reveal the field again after the user closes it.
  await page.locator(".milestone-disclosure > summary").click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("What will be delivered?")).toBeFocused();
  await reflow(page, "job-milestone-invalid");
  await audit(page);
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
  await page.locator(".milestone-disclosure > summary").click();
  await page.getByRole("button", { name: /Add milestone/ }).click();
  const secondJob = page.locator(".milestone-disclosure").nth(1);
  for (const label of [
    "Milestone title",
    "What will be delivered?",
    "How will success be confirmed?",
    "What proof should be provided?",
  ]) {
    await secondJob
      .getByLabel(label)
      .fill(await page.locator(".milestone-disclosure").first().getByLabel(label).inputValue());
  }
  await secondJob.getByLabel("Delivery time").fill("7");
  await secondJob.locator("summary").click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(secondJob.getByLabel("Delivery time")).toBeFocused();
  await expect(page.locator(".milestone-disclosure").first()).toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Remove milestone 2" }).click();
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
  await worker.setViewportSize({ width: 375, height: 812 });
  await worker.getByLabel("Milestone title").fill("");
  await worker.locator(".milestone-disclosure > summary").click();
  await worker.getByRole("button", { name: /Review proposal/ }).click();
  await focusIsExposed(worker.getByLabel("Milestone title"));
  await reflow(worker, "proposal-invalid");
  await audit(worker);
  await worker.locator(".milestone-disclosure > summary").click();
  await worker.getByRole("button", { name: /Review proposal/ }).click();
  await expect(worker.getByLabel("Milestone title")).toBeFocused();
  await worker.getByLabel("Milestone title").fill("Prototype and handoff");
  const timing = worker.locator('.milestone-disclosure input[type="number"]').last();
  await timing.fill("0");
  await worker.locator(".milestone-disclosure > summary").click();
  await worker.getByRole("button", { name: /Review proposal/ }).click();
  await expect(timing).toBeFocused();
  await timing.fill("7");
  for (const [label, invalid] of [
    ["What will you deliver?", ""],
    ["How will success be confirmed?", ""],
    ["Milestone amount", "0"],
    ["What proof will you provide?", ""],
  ]) {
    const field = worker.getByLabel(label);
    const saved = await field.inputValue();
    await field.fill(invalid);
    await worker.locator(".milestone-disclosure > summary").click();
    await worker.getByRole("button", { name: /Review proposal/ }).click();
    await expect(field).toBeFocused();
    await field.fill(saved);
  }

  await expect(worker.getByLabel("Milestone amount")).toHaveValue("150");
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
  await expect(page.getByRole("combobox", { name: /Network/ })).toHaveValue("testnet");
  await expect(page.getByRole("combobox", { name: /Purpose/ })).toHaveCount(0);
  await expect(page.locator(".wallet-beta-explanation")).toContainText(
    "Wallet verification is optional",
  );
  await expect(page.locator(".wallet-beta-explanation")).toContainText(
    "does not activate payments",
  );
  await expect(page.getByRole("link", { name: "Manage identity", exact: true })).toHaveCount(1);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const networkBox = await page.getByRole("combobox", { name: /Network/ }).boundingBox();
  const addressBox = await page.getByLabel("Wallet address").boundingBox();
  expect(Math.abs(networkBox!.width - addressBox!.width)).toBeLessThan(2);
  const sql = postgres(databaseUrl, { max: 1 });
  const profile = await (await sessionRequest(page.request).get("/api/profile")).json();
  await sql`update users set password_hash = null where id = ${profile.data.profile.userId}`;
  await sql.end();
  await page.reload();
  await expect(page.getByLabel("Current password", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText(
      "Add an authenticator app to your account. You do not need a local password to set it up.",
    ),
  ).toBeVisible();
  await reflow(page, "wallet-layout");
  await audit(page);
  await page.getByLabel("Wallet address").fill("ckt-isolated-interface-test-address");
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
  browser,
}) => {
  test.setTimeout(60000);
  await account(page, "Tomi Adeyemi");
  const role = `Designer-${crypto.randomUUID()}`;
  const headers = { Origin: origin };
  expect(
    (
      await sessionRequest(page.request).patch("/api/profile", {
        headers,
        data: {
          displayName: "Tomi Adeyemi",
          headline: "Accessible product design for independent businesses",
          primaryRole: role,
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
  const skill = page.getByLabel("Skills", { exact: true });
  const language = page.getByLabel("Spoken languages", { exact: true });
  await skill.fill("React");
  await skill.press("Enter");
  await language.fill("English");
  await language.press("Enter");
  await expect(page.getByRole("button", { name: "Remove React", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove React", exact: true }).click();
  await page.getByLabel("Filter available timezones").fill("Lagos");
  await page.getByLabel("Timezone", { exact: true }).selectOption("Africa/Lagos");
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect(Math.abs((await skill.boundingBox())!.y - (await language.boundingBox())!.y)).toBeLessThan(
    2,
  );
  await reflow(page, "profile-edit-populated");
  await audit(page);
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Profile saved.", { exact: true })).toBeVisible();
  const preview = page.getByRole("link", { name: "View public profile" });
  const publicPath = (await preview.getAttribute("href"))!;
  const ownerId = publicPath.split("/").at(-1)!;
  await preview.click();
  await expect(page).toHaveURL(new RegExp(ownerId));
  await page.goto(`/talent?role=${role}`);
  await expect(page.locator(".talent-card")).toHaveCount(0);
  for (const sort of ["discover", "recent", "reputation", "completed"]) {
    const result = await sessionRequest(page.request).get(
      `/api/talent?role=${role}&sort=${sort}&limit=1`,
    );
    expect((await result.json()).data).toEqual([]);
  }
  const visitor = await browser.newContext();
  const guest = await visitor.newPage();
  const publicResult = await guest.request.get(`${origin}/api/talent?role=${role}`);
  expect(
    (await publicResult.json()).data.map(
      (item: { profile: { userId: string } }) => item.profile.userId,
    ),
  ).toContain(ownerId);
  await account(guest, "Talent Browser");
  await guest.goto(`${origin}/talent?role=${role}`);
  await expect(guest.locator(".talent-card")).toHaveCount(1);
  await reflow(guest, "talent-populated");
  await audit(guest);
  await visitor.close();
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Both", exact: true }).click();
  await expect(page.locator(".intent-current")).toContainText("Current focus: Both");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("group", { name: "Workspace focus" })).not.toBeVisible();
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await page.getByRole("button", { name: "Hire talent", exact: true }).click();
  await expect(page.getByRole("button", { name: "Hire talent", exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.locator(".intent-current")).toContainText("Current focus: Hire talent");
  await expect(page.getByRole("group", { name: "Workspace focus" })).not.toBeVisible();
  await expect(
    page.locator(".intent-panel").getByRole("link", { name: "Post a job" }),
  ).toBeVisible();
  await expect(
    page.locator(".intent-panel").getByRole("link", { name: "Find talent" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await page.getByRole("button", { name: "Find work", exact: true }).click();
  await expect(page.getByRole("button", { name: "Find work", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await reflow(page, "dashboard-established");
  await audit(page);
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
