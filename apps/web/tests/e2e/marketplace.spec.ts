import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import postgres from "postgres";

const origin = "http://127.0.0.1:3199";
const password = "KlaveroqTest123";
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://klaveroq_test:klaveroq_test@127.0.0.1:55434/klaveroq_test";

async function activateAccount(email: string) {
  const sql = postgres(testDatabaseUrl, { max: 1 });
  await sql`update users set email_verified_at = now(), status = 'ACTIVE' where email = ${email}`;
  await sql.end();
}

async function register(page: Page, email: string, displayName: string) {
  await page.goto("/register");
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/register") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create account" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  await activateAccount(email);
  const session = (await response.allHeaders())["set-cookie"]
    ?.split(";")[0]
    .split("=")
    .slice(1)
    .join("=");
  expect(session).toBeTruthy();
  await page.context().addCookies([
    {
      name: "klaveroq_test_session",
      value: session!,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);
  await page.goto("/");
}

async function completeProfile(page: Page, displayName: string) {
  const profile = await page.request.patch("/api/profile", {
    headers: { Origin: origin },
    data: {
      displayName,
      headline: "Product engineer for reliable marketplace applications",
      bio: "I build accessible production applications with clear milestones, tested behavior, and maintainable delivery documentation.",
      primaryRole: "Product engineer",
      skills: ["react", "typescript", "testing"],
      experienceLevel: "EXPERT",
      yearsExperience: 7,
      languages: ["english"],
      availability: "AVAILABLE",
      timezone: "Africa/Lagos",
      countryCode: "NG",
      preferredWorkCategories: ["DEVELOPMENT"],
      githubUrl: null,
      websiteUrl: null,
      linkedinUrl: null,
    },
  });
  expect(profile.ok()).toBeTruthy();
  const portfolio = await page.request.post("/api/profile/portfolio", {
    headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
    data: {
      title: "Marketplace delivery system",
      description:
        "A production marketplace workflow with accessible screens and tested transactions.",
      projectUrl: "https://example.com/marketplace",
      githubUrl: null,
      skills: ["react", "typescript"],
      projectRole: "Lead engineer",
    },
  });
  expect(portfolio.status()).toBe(201);
  const visibility = await page.request.patch("/api/profile/visibility", {
    headers: { Origin: origin },
    data: { isPublic: true },
  });
  expect(visibility.ok()).toBeTruthy();
}

async function newAccount(context: BrowserContext, email: string, name: string) {
  const page = await context.newPage();
  await register(page, email, name);
  await completeProfile(page, name);
  return page;
}

test("client and workers complete publication, proposals, messaging, award, and agreement creation", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const suffix = Date.now();
  const clientContext = await browser.newContext();
  const workerContext = await browser.newContext();
  const competitorContext = await browser.newContext();
  const client = await newAccount(clientContext, `e2e-client-${suffix}@example.test`, "E2E Client");
  const worker = await newAccount(workerContext, `e2e-worker-${suffix}@example.test`, "E2E Worker");
  const competitor = await newAccount(
    competitorContext,
    `e2e-competitor-${suffix}@example.test`,
    "E2E Competitor",
  );

  await client.goto("/jobs/new/public");
  await client
    .getByLabel("Scope and expected outcome")
    .fill(
      "Build and test a responsive marketplace reporting interface with accessible filtering and a documented handoff.",
    );
  await client.getByLabel("Job title").fill("E2E marketplace reporting interface");
  await client.getByLabel("Category").selectOption("DEVELOPMENT");
  await client.getByLabel("Skills").fill("React, TypeScript, Testing");
  await client.getByRole("button", { name: /Continue/ }).click();
  await client.getByLabel("Milestone title").fill("Working reporting interface");
  await client
    .getByLabel("What will be delivered?")
    .fill("A responsive implementation connected to the agreed data source.");
  await client
    .getByLabel("How will success be confirmed?")
    .fill("Automated tests pass and the agreed layouts render correctly.");
  await client
    .getByLabel("What proof should be provided?")
    .fill("Preview URL, source commit, and test report");
  await client.getByRole("button", { name: /Continue/ }).click();
  await client.getByLabel("Minimum budget (CKB)").fill("100");
  await client.getByLabel("Maximum budget (CKB)").fill("200");
  const deadline = new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10);
  await client.getByLabel("Proposal deadline").fill(deadline);
  await client.getByRole("button", { name: "Save draft" }).click();
  await expect(client).toHaveURL(/\/jobs\/new\/public\?draft=/);
  const listingId = new URL(client.url()).searchParams.get("draft")!;

  const unauthorizedEdit = await worker.request.patch(`/api/marketplace/listings/${listingId}`, {
    headers: { Origin: origin },
    data: { title: "Unauthorized title change" },
  });
  expect(unauthorizedEdit.status()).toBe(404);

  await client.reload();
  await expect(client.getByLabel("Job title")).toHaveValue("E2E marketplace reporting interface");
  await client.getByLabel("Job title").fill("E2E marketplace reporting interface updated");
  await client.getByRole("button", { name: /Continue/ }).click();
  await expect(client.getByLabel("Milestone title")).toHaveValue("Working reporting interface");
  await client.getByRole("button", { name: /Continue/ }).click();
  await expect(client.getByLabel("Minimum budget (CKB)")).toHaveValue("100");
  await client.getByRole("button", { name: "Review job" }).click();
  await client.getByRole("button", { name: "Publish job" }).click();
  await expect(client).toHaveURL(new RegExp(`/discover/${listingId}$`));
  await expect(
    client.getByRole("heading", { name: "E2E marketplace reporting interface updated" }),
  ).toBeVisible();
  await expect(client.getByText("Preview URL, source commit, and test report")).toBeVisible();

  await worker.goto(`/discover?query=marketplace+reporting&category=DEVELOPMENT`);
  await expect(worker.getByText("E2E marketplace reporting interface updated")).toBeVisible();
  await worker.goto(`/discover/${listingId}`);
  await worker
    .getByLabel("Cover letter")
    .fill(
      "I will deliver the reporting interface with accessible components, integration tests, and a clear handoff for your team.",
    );
  await worker.getByLabel("Milestone title").fill("Implementation and verification");
  await worker
    .getByLabel("What will you deliver?")
    .fill("The complete responsive reporting interface and documentation.");
  await worker
    .getByLabel("How will success be confirmed?")
    .fill("All acceptance checks and automated tests pass.");
  await worker.getByLabel("Milestone amount").fill("150");
  await worker
    .getByLabel("What proof will you provide?")
    .fill("Preview URL, commit, and test output");
  await worker.getByRole("button", { name: /Review proposal/ }).click();
  await worker.getByRole("button", { name: "Confirm and submit" }).click();
  await expect(worker.getByRole("button", { name: "Confirm update" })).toBeVisible();
  await worker.getByRole("button", { name: "Edit proposal" }).click();
  await worker
    .getByLabel("Cover letter")
    .fill(
      "I will deliver the reporting interface, responsive verification, integration tests, and an updated handoff for your team.",
    );
  await worker.getByRole("button", { name: /Review proposal/ }).click();
  const updateResponse = worker.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/marketplace/listings/${listingId}/proposal`) &&
      response.request().method() === "PATCH",
  );
  await worker.getByRole("button", { name: "Confirm update" }).click();
  expect((await updateResponse).ok()).toBeTruthy();
  await worker.goto("/jobs?view=proposals");
  await expect(worker.getByText("E2E marketplace reporting interface updated")).toBeVisible();

  const competitorProposal = await competitor.request.post(
    `/api/marketplace/listings/${listingId}/proposals`,
    {
      headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
      data: {
        coverLetter:
          "I can deliver this marketplace interface with careful testing and a concise technical handoff for the product team.",
        totalBid: "14000000000",
        estimatedDurationDays: 9,
        milestones: [
          {
            title: "Competing delivery",
            description: "Implement and verify the complete reporting interface.",
            acceptanceCriteria: "The interface and tests meet all documented requirements.",
            amount: "14000000000",
            evidenceRequirements: "Preview URL and test report",
            deliveryDays: 9,
          },
        ],
      },
    },
  );
  expect(competitorProposal.status()).toBe(201);

  await worker.goto(`/discover/${listingId}`);
  await worker.getByRole("button", { name: "Clarify proposal" }).click();
  await worker
    .getByLabel("Message")
    .fill("Can you confirm that the responsive review includes the mobile filter layout?");
  const workerMessageResponse = worker.waitForResponse(
    (response) =>
      response.url().includes("/api/marketplace/proposals/") &&
      response.url().endsWith("/messages") &&
      response.request().method() === "POST",
  );
  await worker.getByRole("button", { name: "Send" }).click();
  expect((await workerMessageResponse).ok()).toBeTruthy();
  await expect(
    worker.getByText(
      "Can you confirm that the responsive review includes the mobile filter layout?",
    ),
  ).toBeVisible();

  await client.goto(`/discover/${listingId}`);
  const workerCard = client
    .locator(".client-proposals > article")
    .filter({ hasText: "E2E Worker" });
  await expect(workerCard.locator(".thread-unread-count")).toHaveText("1");
  await workerCard.getByRole("button", { name: "Clarify proposal" }).click();
  await expect(workerCard.locator(".thread-unread-count")).toHaveCount(0);
  await expect(
    workerCard.getByText(
      "Can you confirm that the responsive review includes the mobile filter layout?",
    ),
  ).toBeVisible();
  await workerCard
    .getByLabel("Message")
    .fill("Yes, mobile filter wrapping is part of the acceptance review.");
  const clientMessageResponse = client.waitForResponse(
    (response) =>
      response.url().includes("/api/marketplace/proposals/") &&
      response.url().endsWith("/messages") &&
      response.request().method() === "POST",
  );
  await workerCard.getByRole("button", { name: "Send" }).click();
  expect((await clientMessageResponse).ok()).toBeTruthy();
  await worker.reload();
  await expect(worker.locator(".thread-unread-count")).toHaveText("1");
  const shortlistResponse = client.waitForResponse(
    (response) =>
      response.url().includes("/api/marketplace/proposals/") &&
      response.url().endsWith("/shortlist") &&
      response.request().method() === "PATCH",
  );
  await workerCard.getByRole("button", { name: "Shortlist" }).click();
  expect((await shortlistResponse).ok()).toBeTruthy();
  await expect(workerCard.getByRole("button", { name: "Remove shortlist" })).toBeVisible();
  client.once("dialog", (dialog) => dialog.accept());
  await workerCard.getByRole("button", { name: "Award proposal" }).click();
  await expect(client).toHaveURL(/\/jobs\/[0-9a-f-]+$/);
  await expect(client.locator('a[href="/jobs"][aria-current="page"]').first()).toBeVisible();
  const agreementUrl = new URL(client.url()).pathname;
  await expect(
    client.getByText("This is an agreement draft created from the awarded proposal."),
  ).toBeVisible();

  await worker.goto("/jobs");
  await expect(worker.getByText("E2E marketplace reporting interface updated")).toBeVisible();
  await worker.goto(agreementUrl);
  await expect(worker.getByText("You are the worker")).toBeVisible();
  await competitor.goto("/notifications");
  await expect(competitor.getByText("Another proposal was selected")).toBeVisible();

  const quote = await client.request.post("/api/fees/quote", {
    headers: { Origin: origin },
    data: { subtotal: "100000000", asset: "CKB" },
  });
  const quoteBody = await quote.json();
  const unknownInvite = await client.request.post("/api/jobs", {
    headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
    data: {
      title: "Invitation must be claimable",
      description: "This invitation verifies that unknown external email recipients are rejected.",
      workerEmail: `unknown-${suffix}@example.test`,
      asset: "CKB",
      assetDecimals: 8,
      feeQuoteId: quoteBody.data.id,
      milestones: [
        {
          title: "Claimable invitation",
          description: "Verify the existing account requirement.",
          acceptanceCriteria: "The API rejects an unknown recipient.",
          amount: "100000000",
          dueAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
          evidenceRequirements: "Recorded API response",
        },
      ],
    },
  });
  expect(unknownInvite.status()).toBe(404);
  expect((await unknownInvite.json()).error.code).toBe("ACCOUNT_NOT_FOUND");

  await clientContext.close();
  await workerContext.close();
  await competitorContext.close();
});
