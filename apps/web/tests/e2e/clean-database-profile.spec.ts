import { expect, test } from "@playwright/test";
import postgres from "postgres";

const password = "KlaveroqTest123";
const email = "clean-profile@example.test";
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://klaveroq_test:klaveroq_test@127.0.0.1:55434/klaveroq_test";

test("empty database stays demo-free and profile changes persist through repeat sign-in", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const sql = postgres(testDatabaseUrl, { max: 1 });
  const tableCounts = await Promise.all(
    [
      "users",
      "profiles",
      "sessions",
      "auth_identities",
      "portfolio_items",
      "job_listings",
      "jobs",
      "proposals",
      "operations",
      "proof_submissions",
      "marketplace_reviews",
      "identity_verifications",
      "wallets",
    ].map(async (table) => {
      const [row] = await sql.unsafe<{ count: string }[]>(`select count(*) from ${table}`);
      return [table, Number(row.count)] as const;
    }),
  );
  expect(Object.fromEntries(tableCounts)).toEqual(
    Object.fromEntries(tableCounts.map(([table]) => [table, 0])),
  );

  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: "No matching jobs" })).toBeVisible();
  await expect(page.getByText(/Alex Morgan|Maya Chen|KQ-DEMO/i)).toHaveCount(0);
  await page.goto("/talent");
  await expect(page.getByRole("heading", { name: "No matching professionals" })).toBeVisible();

  await page.goto("/register");
  await page.getByLabel("Display name").fill("Clean Profile");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  const registration = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/register") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create account" }).click();
  const registrationResponse = await registration;
  expect(registrationResponse.status()).toBe(201);
  const userId = (await registrationResponse.json()).data.user.id as string;
  await sql`update users set email_verified_at = now(), status = 'ACTIVE' where email = ${email}`;
  await sql`insert into auth_identities (user_id, provider, provider_subject, provider_email)
            values (${userId}, 'google', 'clean-profile-google-subject', ${email})`;
  const [initialized] = await sql`
    select p.display_name, p.headline, p.bio, p.primary_role, p.experience_level,
           p.country_code, p.timezone, p.is_public,
           (select count(*)::int from auth_identities ai where ai.user_id = p.user_id and ai.provider = 'google') identities
    from profiles p where p.user_id = ${userId}
  `;
  expect(initialized).toEqual({
    display_name: "Clean Profile",
    headline: null,
    bio: null,
    primary_role: null,
    experience_level: null,
    country_code: null,
    timezone: null,
    is_public: false,
    identities: 1,
  });

  await page.goto("/profile");
  await page.getByRole("button", { name: "Edit profile" }).click();
  await page.getByLabel("Display name").fill("Clean Profile Saved");
  const nameOnlySave = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/profile") && response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Save profile" }).click();
  expect((await nameOnlySave).status()).toBe(200);
  await expect(page.getByText("Private profile saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Clean Profile Saved" })).toBeVisible();

  const incompletePublish = page.waitForResponse((response) =>
    response.url().endsWith("/api/profile/visibility"),
  );
  await page.getByRole("button", { name: "Publish profile" }).click();
  expect((await incompletePublish).status()).toBe(422);
  await expect(page.getByText(/Complete your profile before publishing:/)).toBeVisible();

  await page.getByRole("button", { name: "Edit profile" }).click();
  await page.getByLabel("Display name").fill("x");
  const invalidSave = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/profile") && response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Save profile" }).click();
  expect((await invalidSave).status()).toBe(400);
  await expect(page.locator("#display-name-error")).toContainText("at least 2");
  await expect(page.getByLabel("Display name")).toHaveValue("x");

  await page.getByLabel("Display name").fill("Clean Profile Saved");
  await page.getByLabel("Primary role").fill("Product engineer");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Private profile saved.")).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/profile");
  await expect(page.getByText("Product engineer", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit profile" }).click();
  await page.getByLabel("Professional headline").fill("Reliable marketplace product engineer");
  await page
    .getByLabel("Bio")
    .fill(
      "I build reliable marketplace products with accessible interfaces, explicit milestones, and tested delivery workflows.",
    );
  await page.getByLabel("Skills").fill("TypeScript, React, testing");
  await page.getByLabel("Languages").fill("English");
  await page.getByLabel("Experience level").selectOption("EXPERT");
  await page.getByLabel("Country").selectOption("NG");
  await page.getByLabel("Timezone").fill("Africa/Lagos");

  let failNextSave = true;
  await page.route("**/api/profile", async (route) => {
    if (route.request().method() === "PATCH" && failNextSave) {
      failNextSave = false;
      await route.fulfill({ status: 502, contentType: "text/plain", body: "upstream unavailable" });
      return;
    }
    await route.fallback();
  });
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile could not be saved. Please try again.")).toBeVisible();
  await expect(page.getByLabel("Professional headline")).toHaveValue(
    "Reliable marketplace product engineer",
  );
  await page.unroute("**/api/profile");

  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Private profile saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Reliable marketplace product engineer")).toBeVisible();
  await expect(page.getByText("typescript")).toBeVisible();
  await sql.end();

  const portfolio = page.locator(".portfolio-manager");
  await portfolio.getByRole("button", { name: "Add project" }).first().click();
  await page.getByLabel("Project title").fill("Persistent marketplace profile");
  await page.getByLabel("Your role").fill("Lead engineer");
  await page
    .getByLabel("Description")
    .fill("A production profile and portfolio workflow with browser-tested persistence.");
  await page.getByLabel("Skills and technologies").fill("TypeScript, Playwright");
  await portfolio.locator(".portfolio-form").getByRole("button", { name: "Add project" }).click();
  await expect(page.getByText("Portfolio saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Persistent marketplace profile")).toBeVisible();

  await page.getByRole("button", { name: "Edit Persistent marketplace profile" }).click();
  await page
    .getByLabel("Description")
    .fill("An edited professional profile workflow that persists after a full page refresh.");
  await page.getByRole("button", { name: "Update project" }).click();
  await expect(page.getByText(/edited professional profile workflow/i)).toBeVisible();

  await page.getByRole("button", { name: "Publish profile" }).click();
  await expect(page.getByRole("button", { name: "Make profile private" })).toBeVisible();

  await page.getByRole("button", { name: "Edit profile" }).click();
  await page.getByLabel("Display name").fill("Published Profile Name");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Make profile private" })).toBeVisible();

  await page.getByRole("button", { name: "Edit profile" }).click();
  await page.getByLabel("Professional headline").fill("");
  const incompletePublishedEdit = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/profile") && response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Save profile" }).click();
  expect((await incompletePublishedEdit).status()).toBe(409);
  await expect(page.getByRole("button", { name: "Save and make private" })).toBeVisible();
  await expect(page.getByLabel("Professional headline")).toHaveValue("");
  await page.getByLabel("Professional headline").fill("Reliable marketplace product engineer");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Published Profile Name" })).toBeVisible();
  await expect(page.getByText("Reliable marketplace product engineer")).toBeVisible();
  await expect(page.getByText(/edited professional profile workflow/i)).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Persistent marketplace profile" }).click();
  await expect(page.getByText("Portfolio item removed.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Persistent marketplace profile")).toHaveCount(0);
});
