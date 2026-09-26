import { expect, test, type Page, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import postgres from "postgres";

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://klaveroq_test:klaveroq_test@127.0.0.1:55434/klaveroq_test";
async function account(request: APIRequestContext, name: string) {
  const setup = postgres(databaseUrl, { max: 1 });
  await setup`delete from auth_rate_limits where action = 'register'`;
  await setup.end();
  const email = `ux-${crypto.randomUUID()}@example.test`;
  const response = await request.post("/api/auth/register", {
    headers: { Origin: "http://127.0.0.1:3199" },
    data: { email, password: "KlaveroqTest123", displayName: name },
  });
  expect(response.status()).toBe(201);
  const id = (await response.json()).data.user.id as string;
  const sql = postgres(databaseUrl, { max: 1 });
  await sql`update users set email_verified_at = now(), status = 'ACTIVE' where id = ${id}`;
  await sql.end();
  return id;
}
async function accessible(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect
    .soft(
      result.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")),
      page.url(),
    )
    .toEqual([]);
}

test("mobile public navigation keeps hiring and sign-in reachable and preserves the destination", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/talent?skill=Design");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.locator(".public-mobile-nav summary").click();
  const menu = page.getByRole("navigation", { name: "Mobile marketplace navigation" });
  await expect(menu.getByRole("link", { name: "Find work" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Find talent" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/login?returnTo=%2Ftalent%3Fskill%3DDesign",
  );
  await accessible(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(".public-mobile-nav summary")).toBeFocused();
  await expect(menu).not.toBeVisible();
  await page.screenshot({ path: test.info().outputPath("mobile-marketplace.png"), fullPage: true });
});

test("compact filters support saved searches, removable chips and mobile reflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/discover");
  await expect(page.getByLabel("Category", { exact: true })).not.toBeVisible();
  await page.locator(".discovery-filter-options summary").click();
  await page.getByLabel("Skill", { exact: true }).fill("unmatched-ux-skill");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("heading", { name: "No matching jobs" })).toBeVisible();
  await page.locator(".saved-searches summary").click();
  await page.getByLabel("Search name").fill("My design search");
  await page.getByRole("button", { name: "Save current search" }).click();
  await page.reload();
  await page.locator(".saved-searches summary").click();
  await expect(page.getByRole("link", { name: "My design search" })).toBeVisible();
  await page.getByRole("link", { name: "Remove skill filter: unmatched-ux-skill" }).click();
  await expect(page).not.toHaveURL(/skill=/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});

test("signed-in navigation, focus choice, profile tags and unsaved work protection", async ({
  page,
}) => {
  await account(page.request, "UX Profile");
  await page.goto("/");
  await page.getByRole("button", { name: "Hire talent", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Hire talent", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("Secured in jobs", { exact: true })).toHaveCount(0);
  await page.goto("/talent");
  await expect(
    page.getByRole("navigation", { name: "Main navigation", exact: true }),
  ).toBeVisible();
  await page.goto("/profile");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page.getByLabel("Skills", { exact: true }).fill("React");
  await page.getByLabel("Skills", { exact: true }).press("Enter");
  await expect(page.getByRole("button", { name: "Remove React", exact: true })).toBeVisible();
  await page.getByLabel("Filter available locations").fill("Nigeria");
  await page.getByLabel("Country", { exact: true }).selectOption("NG");
  await page.getByLabel("Display name").fill("UX Updated");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByLabel("Display name")).toHaveValue("UX Updated");
  await accessible(page);
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Private profile saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "UX Updated", exact: true })).toBeVisible();
  await expect(page.getByText("react", { exact: true })).toBeVisible();
});

test("authenticated pages and mobile menu support keyboard access", async ({ page }) => {
  await account(page.request, "UX Access");
  for (const path of ["/jobs", "/wallet", "/notifications", "/support"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await accessible(page);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/jobs");
  await expect(page.getByRole("heading", { name: "Jobs", exact: true })).toBeVisible();
  const open = page.getByRole("button", { name: "Open menu", exact: true });
  await open.click();
  await expect(page.locator(".sidebar")).toBeVisible();
  await accessible(page);
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Log out", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});

test("support keeps draft text after network failure and focuses the error", async ({ page }) => {
  await account(page.request, "UX Support");
  await page.goto("/support");
  await page.getByLabel("Subject", { exact: true }).fill("Help with my project");
  await page
    .getByLabel("Message", { exact: true })
    .fill("My work needs clarification before I submit evidence.");
  await page.route("**/api/support/tickets", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page.getByRole("button", { name: "Submit case" }).click();
  await expect(page.locator(".form-feedback[role=alert]")).toContainText("could not be sent");
  await expect(page.locator(".form-feedback[role=alert]")).toBeFocused();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
    "My work needs clarification before I submit evidence.",
  );
  await expect(page.getByRole("button", { name: "Submit case" })).toBeEnabled();
});

test("shortlists persist and comparison uses current public data", async ({ page, playwright }) => {
  await account(page.request, "UX Hiring");
  const prefix = `UX Compare ${Date.now()}`;
  const names = [`${prefix} One`, `${prefix} Two`];
  const ids: string[] = [];
  for (const name of names) {
    const context = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3199",
      extraHTTPHeaders: { Origin: "http://127.0.0.1:3199" },
    });
    const id = await account(context, name);
    ids.push(id);
    const fixtureHeaders = {
      Cookie: (await context.storageState()).cookies
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join("; "),
    };
    const result = await context.patch("/api/profile", {
      headers: fixtureHeaders,
      data: {
        displayName: name,
        headline: "UX comparison professional",
        primaryRole: "Designer",
        bio: "I design clear accessible interfaces for professional marketplaces and complex workflows.",
        skills: ["Design"],
        experienceLevel: "EXPERT",
        countryCode: "NG",
        timezone: "Africa/Lagos",
        availability: "AVAILABLE",
      },
    });
    expect(result.ok()).toBe(true);
    expect(
      (
        await context.patch("/api/profile/visibility", {
          headers: fixtureHeaders,
          data: { isPublic: true },
        })
      ).ok(),
    ).toBe(true);
    await context.dispose();
  }
  await page.goto(`/talent?query=${encodeURIComponent(prefix)}`);
  await page.getByRole("button", { name: `Shortlist ${names[0]}`, exact: true }).click();
  await page.getByRole("button", { name: `Shortlist ${names[1]}`, exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: `Shortlist ${names[0]}`, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "View shortlist & compare" }).click();
  await expect(page.getByRole("table")).toContainText(names[0]);
  await expect(page.getByRole("table")).toContainText("Skills · self-reported");
  await accessible(page);
  await page.screenshot({ path: test.info().outputPath("talent-comparison.png"), fullPage: true });
  await page.getByRole("button", { name: "Close comparison" }).click();
  const sql = postgres(databaseUrl, { max: 1 });
  await sql`update profiles set is_public = false where user_id = ${ids[0]}`;
  await sql.end();
  await page.getByRole("button", { name: "View shortlist & compare" }).click();
  await expect(page.getByRole("table")).toContainText("Profile unavailable");
  await expect(page.getByRole("table")).not.toContainText(names[0]);
});

test("job validation focuses the first invalid field and agreement guidance stays truthful", async ({
  page,
}) => {
  const id = await account(page.request, "UX Agreement");
  await page.goto("/jobs/new/direct");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Job title", { exact: false })).toBeFocused();
  await expect(page.getByLabel("Job title", { exact: false })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await accessible(page);
  const sql = postgres(databaseUrl, { max: 1 });
  const [job] =
    await sql`insert into jobs (reference, client_user_id, worker_email, title, description, subtotal, client_fee, network_reserve, status)
    values (${`JOB-UX-${Date.now()}`}, ${id}, 'ux-worker@example.test', 'Accessible agreement workspace', 'Agree on a clear outcome with verifiable proof before beginning work.', 1000000000, 0, 0, 'INVITED') returning id`;
  await sql`insert into milestones (job_id, sequence, title, description, acceptance_criteria, amount, due_at, evidence_requirements, status)
    values (${job.id}, 1, 'Accessible design delivery', 'Deliver a reviewed prototype.', 'Keyboard navigation works across the workflow.', 1000000000, now() + interval '7 days', 'A prototype link and accessibility review', 'PENDING')`;
  await sql.end();
  await page.goto(`/jobs/${job.id}`);
  await expect(
    page.getByRole("heading", { name: "Waiting for payment integration", exact: true }),
  ).toBeVisible();
  await accessible(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: test.info().outputPath("mobile-agreement.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});
