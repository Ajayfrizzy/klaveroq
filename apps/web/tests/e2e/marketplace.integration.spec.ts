import { expect, request, test, type APIRequestContext } from "@playwright/test";
import postgres from "postgres";

const baseURL = "http://127.0.0.1:3199";
const password = "KlaveroqTest123";
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://klaveroq_test:klaveroq_test@127.0.0.1:55434/klaveroq_test";

async function account(email: string, displayName: string) {
  const bootstrap = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  const registered = await bootstrap.post("/api/auth/register", {
    data: { email, displayName, password },
  });
  expect(registered.status()).toBe(201);
  const session = registered.headers()["set-cookie"]?.split(";")[0];
  expect(session).toBeTruthy();
  const sql = postgres(testDatabaseUrl, { max: 1 });
  await sql`update users set email_verified_at = now(), status = 'ACTIVE' where email = ${email}`;
  await sql.end();
  await bootstrap.dispose();
  const api = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL, Cookie: session! },
  });
  expect(
    (
      await api.patch("/api/profile", {
        data: {
          displayName,
          headline: "Integration test marketplace specialist",
          bio: "I deliver reliable marketplace work with explicit milestones and database-backed integration tests.",
          primaryRole: "Marketplace specialist",
          skills: ["testing", "typescript"],
          experienceLevel: "EXPERT",
          yearsExperience: 5,
          languages: ["english"],
          availability: "AVAILABLE",
          timezone: "Africa/Lagos",
          countryCode: "NG",
          preferredWorkCategories: ["DEVELOPMENT"],
          githubUrl: null,
          websiteUrl: null,
          linkedinUrl: null,
        },
      })
    ).ok(),
  ).toBeTruthy();
  return api;
}

const proposalPayload = (amount: string, suffix: string) => ({
  coverLetter: `I will deliver the integration-tested marketplace result with clear evidence and maintainable documentation for ${suffix}.`,
  totalBid: amount,
  estimatedDurationDays: 7,
  milestones: [
    {
      title: `Delivery ${suffix}`,
      description: "Implement and verify the complete marketplace deliverable.",
      acceptanceCriteria: "All documented acceptance checks pass.",
      amount,
      evidenceRequirements: "Test output and source reference",
      deliveryDays: 7,
    },
  ],
});

async function json(api: APIRequestContext, path: string) {
  const response = await api.get(path);
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test("listing, concurrent proposal, message, and award transactions remain isolated", async () => {
  const suffix = Date.now();
  const client = await account(`integration-client-${suffix}@example.test`, "Integration Client");
  const worker = await account(`integration-worker-${suffix}@example.test`, "Integration Worker");
  const other = await account(`integration-other-${suffix}@example.test`, "Integration Other");

  const deadline = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const created = await client.post("/api/marketplace/listings", {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    data: {
      title: "Database transaction integration listing",
      description:
        "Exercise listing, proposal, award, and agreement persistence against isolated PostgreSQL.",
      category: "DEVELOPMENT",
      skills: ["typescript", "testing"],
      budgetMin: "10000000000",
      budgetMax: "20000000000",
      proposalDeadline: deadline,
      milestones: [
        {
          title: "Verified implementation",
          deliverable: "A complete implementation covered by integration tests.",
          acceptanceCriteria: "The specified transactions and permissions pass.",
          evidenceRequirements: "Automated test output",
          deliveryDays: 7,
        },
      ],
    },
  });
  expect(created.status()).toBe(201);
  const listingId = (await created.json()).data.id as string;
  expect((await client.post(`/api/marketplace/listings/${listingId}/publish`)).ok()).toBeTruthy();

  const selfProposal = await client.post(`/api/marketplace/listings/${listingId}/proposals`, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    data: proposalPayload("15000000000", "self"),
  });
  expect(selfProposal.status()).toBe(400);
  expect((await selfProposal.json()).error.code).toBe("SELF_PROPOSAL_NOT_ALLOWED");

  const forbiddenEdit = await worker.patch(`/api/marketplace/listings/${listingId}`, {
    data: { title: "Cross-account edit" },
  });
  expect(forbiddenEdit.status()).toBe(404);

  const first = await worker.post(`/api/marketplace/listings/${listingId}/proposals`, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    data: proposalPayload("15000000000", "worker"),
  });
  const second = await other.post(`/api/marketplace/listings/${listingId}/proposals`, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    data: proposalPayload("14000000000", "competitor"),
  });
  expect(first.status()).toBe(201);
  expect(second.status()).toBe(201);
  const firstId = (await first.json()).data.id as string;

  const duplicate = await worker.post(`/api/marketplace/listings/${listingId}/proposals`, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    data: proposalPayload("16000000000", "duplicate"),
  });
  expect(duplicate.status()).toBe(409);

  const message = await worker.post(`/api/marketplace/proposals/${firstId}/messages`, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    data: { body: "Please confirm the integration evidence expected for the final milestone." },
  });
  expect(message.status()).toBe(201);
  expect((await client.get(`/api/marketplace/proposals/${firstId}/messages`)).ok()).toBeTruthy();
  expect((await other.get(`/api/marketplace/proposals/${firstId}/messages`)).status()).toBe(404);

  const award = await client.post(`/api/marketplace/proposals/${firstId}/award`, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
  expect(award.ok()).toBeTruthy();
  const jobId = (await award.json()).data.jobId as string;
  const replay = await client.post(`/api/marketplace/proposals/${firstId}/award`, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
  expect(replay.status()).toBe(409);
  const closedApplication = await other.post(`/api/marketplace/listings/${listingId}/proposals`, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    data: proposalPayload("14500000000", "closed"),
  });
  expect(closedApplication.status()).toBe(409);
  expect((await closedApplication.json()).error.code).toBe("LISTING_CLOSED");

  const clientJobs = await json(client, "/api/jobs");
  const workerJobs = await json(worker, "/api/jobs");
  expect(clientJobs.data).toContainEqual(expect.objectContaining({ id: jobId, status: "DRAFT" }));
  expect(workerJobs.data).toContainEqual(expect.objectContaining({ id: jobId, status: "DRAFT" }));
  expect((await json(other, "/api/notifications")).data).toContainEqual(
    expect.objectContaining({ type: "PROPOSAL_REJECTED" }),
  );

  await client.dispose();
  await worker.dispose();
  await other.dispose();
});
