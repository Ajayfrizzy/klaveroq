import {
  expect,
  request,
  test,
  type APIRequestContext,
  type Browser,
  type Page,
} from "@playwright/test";
import postgres from "postgres";

const origin = "http://127.0.0.1:3199";
const password = "KlaveroqTest123";
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://klaveroq_test:klaveroq_test@127.0.0.1:55434/klaveroq_test";

test.use({ actionTimeout: 15_000 });

type Account = { id: string; api: APIRequestContext; page: Page };

async function account(browser: Browser, email: string, name: string): Promise<Account> {
  const bootstrap = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  const response = await bootstrap.post("/api/auth/register", {
    data: { email, displayName: name, password },
  });
  expect(response.status()).toBe(201);
  const cookie = response.headers()["set-cookie"]!.split(";")[0];
  const token = cookie.slice(cookie.indexOf("=") + 1);
  const sql = postgres(testDatabaseUrl, { max: 1 });
  const [user] =
    await sql`update users set email_verified_at = now(), status = 'ACTIVE' where email = ${email} returning id`;
  await sql`delete from auth_rate_limits where action = 'register'`;
  await sql.end();
  await bootstrap.dispose();
  const api = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin, Cookie: cookie },
  });
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: "klaveroq_test_session",
      value: token,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);
  return { id: user.id, api, page: await context.newPage() };
}

async function createJob(
  clientId: string,
  workerId: string,
  workerEmail: string,
  status: string,
  suffix: string,
) {
  const sql = postgres(testDatabaseUrl, { max: 1 });
  const [job] = await sql`
    insert into jobs (reference, client_user_id, worker_user_id, worker_email, title, description, subtotal, client_fee, network_reserve, status)
    values (${`JOB-P5-${suffix}`}, ${clientId}, ${workerId}, ${workerEmail}, ${`Phase 5 agreement ${suffix}`}, 'Agreement fixture created only in the disposable browser-test database.', 10000000000, 0, 0, ${status})
    returning id
  `;
  const [milestone] = await sql`
    insert into milestones (job_id, sequence, title, description, acceptance_criteria, amount, due_at, evidence_requirements, status)
    values (${job.id}, 1, 'Verified delivery', 'Complete the agreed delivery.', 'The submitted evidence meets the terms.', 10000000000, now() + interval '7 days', 'A completion note and supporting file', ${status === "IN_PROGRESS" ? "ACTIVE" : "PENDING"})
    returning id
  `;
  await sql.end();
  return { jobId: job.id as string, milestoneId: milestone.id as string };
}

test("agreement proof, revision, approval, cancellation, and both reviews work through the browser", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const suffix = Date.now().toString();
  const client = await account(
    browser,
    `phase5-client-${suffix}@example.test`,
    "Phase Five Client",
  );
  const workerEmail = `phase5-worker-${suffix}@example.test`;
  const worker = await account(browser, workerEmail, "Phase Five Worker");
  const { jobId } = await createJob(client.id, worker.id, workerEmail, "DRAFT", suffix);

  await client.page.goto(`/jobs/${jobId}`);
  const confirmationResponse = client.page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/jobs/${jobId}/confirm`) &&
      response.request().method() === "POST",
  );
  await client.page.getByRole("button", { name: "Confirm terms" }).click();
  expect((await confirmationResponse).status()).toBe(200);
  await client.page.reload();
  await expect(client.page.getByText("Funding is unavailable until PactAgent")).toBeVisible();
  await worker.page.goto(`/jobs/${jobId}`);
  await expect(worker.page.getByRole("heading", { name: "Invitation confirmed" })).toBeVisible();
  await expect(worker.page.getByText(/no acceptance or work is due yet/i)).toBeVisible();
  await worker.page.goto("/notifications");
  await expect(
    worker.page.getByText(`Agreement invitation: Phase 5 agreement ${suffix}`),
  ).toBeVisible();
  await worker.page.goto(`/jobs/${jobId}`);

  const sql = postgres(testDatabaseUrl, { max: 1 });
  await sql`update jobs set status = 'IN_PROGRESS' where id = ${jobId}`;
  await sql`update milestones set status = 'ACTIVE' where job_id = ${jobId}`;
  await worker.page.reload();
  await worker.page
    .getByRole("heading", { name: "Submit milestone proof" })
    .locator("..")
    .locator("select")
    .first()
    .selectOption({ label: "Verified delivery" });
  await worker.page
    .getByLabel("Completion note")
    .fill("First delivery with reproducible browser evidence.");
  await worker.page.getByRole("button", { name: "Submit proof" }).click();
  await expect(worker.page).toHaveURL(new RegExp(`${jobId}\\?proof=submitted`));

  await client.page.reload();
  await client.page
    .getByLabel("Revision reason")
    .fill("Please include the missing acceptance detail in the revised evidence.");
  await client.page.getByRole("button", { name: "Request revision" }).click();
  await expect(client.page.getByText("The agreement record was updated.")).toBeVisible();
  await worker.page.reload();
  await worker.page
    .getByRole("heading", { name: "Submit milestone proof" })
    .locator("..")
    .locator("select")
    .first()
    .selectOption({ label: "Verified delivery" });
  await worker.page
    .getByLabel("Completion note")
    .fill("Revised delivery now includes every requested acceptance detail.");
  const revisedProofResponse = worker.page.waitForResponse(
    (response) =>
      response.url().includes(`/api/milestones/`) &&
      response.url().endsWith("/proofs") &&
      response.request().method() === "POST",
  );
  await worker.page.getByRole("button", { name: "Submit proof" }).click();
  expect((await revisedProofResponse).status()).toBe(201);
  await client.page.reload();
  await client.page.getByRole("button", { name: "Approve work" }).click();
  await expect(client.page.getByText("The agreement record was updated.")).toBeVisible();
  const [release] =
    await sql`select status from operations where job_id = ${jobId} and type = 'MILESTONE_RELEASE'`;
  expect(release.status).toBe("PENDING");

  await sql`update jobs set status = 'COMPLETED', completed_at = now() where id = ${jobId}`;
  await client.page.reload();
  await client.page.getByRole("button", { name: "5 star rating" }).click();
  await client.page
    .getByRole("textbox", { name: "Review", exact: true })
    .fill("Clear delivery and responsive revision handling.");
  await client.page.getByRole("button", { name: "Submit verified review" }).click();
  await expect(client.page.getByText("Your verified review is recorded.")).toBeVisible();
  await worker.page.reload();
  await worker.page.getByRole("button", { name: "5 star rating" }).click();
  await worker.page
    .getByRole("textbox", { name: "Review", exact: true })
    .fill("Clear requirements and timely review decisions.");
  await worker.page.getByRole("button", { name: "Submit verified review" }).click();
  await expect(worker.page.getByText("Your verified review is recorded.")).toBeVisible();

  const cancellation = await createJob(
    client.id,
    worker.id,
    workerEmail,
    "IN_PROGRESS",
    `${suffix}-cancel`,
  );
  await client.page.goto(`/jobs/${cancellation.jobId}`);
  await client.page
    .getByRole("heading", { name: "Request cancellation" })
    .locator("..")
    .getByLabel("Reason")
    .fill("The participants agreed to end this test engagement early.");
  await client.page.getByRole("button", { name: "Submit cancellation" }).click();
  await expect(client.page.getByText("The agreement record was updated.")).toBeVisible();
  await worker.page.goto(`/jobs/${cancellation.jobId}`);
  await worker.page.getByRole("button", { name: "Decline" }).click();
  await expect(worker.page.getByText("The agreement record was updated.")).toBeVisible();
  await sql.end();
});

test("participants submit dispute evidence and two administrators approve only pending settlement", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const suffix = Date.now().toString();
  const client = await account(browser, `dispute-client-${suffix}@example.test`, "Dispute Client");
  const workerEmail = `dispute-worker-${suffix}@example.test`;
  const worker = await account(browser, workerEmail, "Dispute Worker");
  const firstAdmin = await account(
    browser,
    `dispute-admin-a-${suffix}@example.test`,
    "First Adjudicator",
  );
  const secondAdmin = await account(
    browser,
    `dispute-admin-b-${suffix}@example.test`,
    "Second Approver",
  );
  const sql = postgres(testDatabaseUrl, { max: 1 });
  await sql`update users set system_role = 'DISPUTE_ADMIN' where id in (${firstAdmin.id}, ${secondAdmin.id})`;
  const { jobId } = await createJob(client.id, worker.id, workerEmail, "IN_PROGRESS", suffix);

  await client.page.goto(`/jobs/${jobId}`);
  await client.page
    .getByRole("heading", { name: "Open a dispute" })
    .locator("..")
    .getByLabel("Description")
    .fill(
      "The delivered work does not match the documented acceptance criteria and requires formal review.",
    );
  await client.page.getByRole("button", { name: "Open dispute" }).click();
  await expect(client.page.getByText("The agreement record was updated.")).toBeVisible();
  await client.page.reload();
  await expect(client.page.getByRole("heading", { name: "Dispute record" })).toBeVisible();
  await worker.page.goto(`/jobs/${jobId}`);
  await worker.page
    .getByLabel("Evidence note")
    .fill(
      "The attached delivery note explains how the submitted work satisfies the agreed criteria.",
    );
  await worker.page.getByLabel("Supporting files").setInputFiles({
    name: "delivery-evidence.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Phase 5 dispute evidence from the disposable browser test."),
  });
  const evidenceResponse = worker.page.waitForResponse(
    (response) =>
      response.url().includes("/api/disputes/") &&
      response.url().endsWith("/evidence") &&
      response.request().method() === "POST",
  );
  await worker.page.getByRole("button", { name: "Submit evidence" }).click();
  expect((await evidenceResponse).status()).toBe(201);
  await worker.page.reload();
  await expect(worker.page.getByText("The attached delivery note explains")).toBeVisible();
  await expect(worker.page.getByRole("link", { name: /delivery-evidence\.txt/ })).toBeVisible();

  await firstAdmin.page.goto("/admin");
  await expect(firstAdmin.page).toHaveURL(/\/admin\/disputes$/);
  await firstAdmin.page.getByText(`JOB-P5-${suffix}`).click();
  await expect(firstAdmin.page).toHaveURL(/\/admin\/disputes\/[0-9a-f-]+$/);
  const disputeId = firstAdmin.page.url().split("/").at(-1)!;
  await expect(firstAdmin.page.getByText("The attached delivery note explains")).toBeVisible();
  await firstAdmin.page.getByLabel(/Worker allocation/).fill("60");
  await firstAdmin.page
    .getByLabel("Decision rationale")
    .fill(
      "The evidence supports a partial worker allocation while refunding the unsupported portion to the client.",
    );
  await firstAdmin.page.getByLabel("Independent approver").selectOption(secondAdmin.id);
  const proposalResponse = firstAdmin.page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/admin/disputes/${disputeId}/decision`) &&
      response.request().method() === "POST",
  );
  await firstAdmin.page.getByRole("button", { name: "Submit for approval" }).click();
  expect((await proposalResponse).status()).toBe(201);
  await firstAdmin.page.reload();
  await expect(firstAdmin.page.getByText("Awaiting independent approval")).toBeVisible();

  await secondAdmin.page.goto(`/admin/disputes/${disputeId}`);
  const approvalResponse = secondAdmin.page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/admin/disputes/${disputeId}/decision`) &&
      response.request().method() === "POST",
  );
  await secondAdmin.page.getByRole("button", { name: "Approve decision" }).click();
  expect((await approvalResponse).status()).toBe(200);
  await secondAdmin.page.reload();
  await expect(secondAdmin.page.getByText("PactAgent confirmation required")).toBeVisible();
  const [operation] =
    await sql`select status, external_reference from operations where job_id = ${jobId} and type = 'DISPUTE_SETTLEMENT'`;
  expect(operation.status).toBe("PENDING");
  expect(operation.external_reference).toBeNull();
  const [heldJob] = await sql`select status from jobs where id = ${jobId}`;
  expect(heldJob.status).toBe("SECURITY_HOLD");
  await worker.page.reload();
  await expect(worker.page.getByText("Approved decision")).toBeVisible();
  await expect(worker.page.getByText("PactAgent confirmation is required")).toBeVisible();
  await sql.end();
});

test("concurrent agreement and dispute mutations produce one authoritative transition", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const suffix = Date.now().toString();
  const client = await account(browser, `race-client-${suffix}@example.test`, "Race Client");
  const workerEmail = `race-worker-${suffix}@example.test`;
  const worker = await account(browser, workerEmail, "Race Worker");
  const adminA = await account(browser, `race-admin-a-${suffix}@example.test`, "Race Admin A");
  const adminB = await account(browser, `race-admin-b-${suffix}@example.test`, "Race Admin B");
  const sql = postgres(testDatabaseUrl, { max: 1 });
  await sql`update users set system_role = 'DISPUTE_ADMIN' where id in (${adminA.id}, ${adminB.id})`;

  const proofJob = await createJob(
    client.id,
    worker.id,
    workerEmail,
    "IN_PROGRESS",
    `${suffix}-proof`,
  );
  const proofResponses = await Promise.all([
    worker.api.post(`/api/milestones/${proofJob.milestoneId}/proofs`, {
      data: { note: "Concurrent proof submission with valid evidence notes.", links: [] },
    }),
    worker.api.post(`/api/milestones/${proofJob.milestoneId}/proofs`, {
      data: { note: "Concurrent proof submission with valid evidence notes.", links: [] },
    }),
  ]);
  expect(proofResponses.map((item) => item.status()).sort()).toEqual([201, 409]);

  const reviewResponses = await Promise.all([
    client.api.post(`/api/milestones/${proofJob.milestoneId}/review`, {
      data: { decision: "APPROVE" },
    }),
    client.api.post(`/api/milestones/${proofJob.milestoneId}/review`, {
      data: { decision: "APPROVE" },
    }),
  ]);
  expect(reviewResponses.map((item) => item.status()).sort()).toEqual([200, 409]);

  const cancelJob = await createJob(
    client.id,
    worker.id,
    workerEmail,
    "IN_PROGRESS",
    `${suffix}-cancel`,
  );
  const cancelResponses = await Promise.all([
    client.api.post(`/api/jobs/${cancelJob.jobId}/cancellation`, {
      data: { action: "REQUEST", reason: "Concurrent cancellation request for state validation." },
    }),
    client.api.post(`/api/jobs/${cancelJob.jobId}/cancellation`, {
      data: { action: "REQUEST", reason: "Concurrent cancellation request for state validation." },
    }),
  ]);
  expect(cancelResponses.map((item) => item.status()).sort()).toEqual([200, 409]);

  const completed = await createJob(
    client.id,
    worker.id,
    workerEmail,
    "COMPLETED",
    `${suffix}-review`,
  );
  const marketplaceReviewResponses = await Promise.all([
    client.api.post(`/api/jobs/${completed.jobId}/reviews`, {
      data: { rating: 5, comment: "Concurrent verified review submission." },
    }),
    client.api.post(`/api/jobs/${completed.jobId}/reviews`, {
      data: { rating: 5, comment: "Concurrent verified review submission." },
    }),
  ]);
  expect(marketplaceReviewResponses.map((item) => item.status()).sort()).toEqual([201, 409]);

  const disputeJob = await createJob(
    client.id,
    worker.id,
    workerEmail,
    "IN_PROGRESS",
    `${suffix}-dispute`,
  );
  const [dispute] = await sql`
    insert into disputes (reference, job_id, opened_by, reason_code, description, status, evidence_due_at)
    values (${`KQ-D-RACE-${suffix}`}, ${disputeJob.jobId}, ${client.id}, 'OTHER', 'Concurrent dispute decision fixture in the disposable database.', 'EVIDENCE_COLLECTION', now() + interval '3 days') returning id
  `;
  await sql`update jobs set status = 'DISPUTED' where id = ${disputeJob.jobId}`;
  const decisionBody = {
    action: "PROPOSE",
    workerShareBps: 5000,
    clientRefundBps: 5000,
    rationale: "The evidence supports an equal allocation for this concurrent decision test.",
    requiredApproverId: adminB.id,
  };
  const proposed = await Promise.all([
    adminA.api.post(`/api/admin/disputes/${dispute.id}/decision`, { data: decisionBody }),
    adminA.api.post(`/api/admin/disputes/${dispute.id}/decision`, { data: decisionBody }),
  ]);
  expect(proposed.map((item) => item.status()).sort()).toEqual([201, 409]);
  const approved = await Promise.all([
    adminB.api.post(`/api/admin/disputes/${dispute.id}/decision`, { data: { action: "APPROVE" } }),
    adminB.api.post(`/api/admin/disputes/${dispute.id}/decision`, { data: { action: "APPROVE" } }),
  ]);
  expect(approved.map((item) => item.status()).sort()).toEqual([200, 409]);
  const [{ count }] =
    await sql`select count(*)::int as count from operations where idempotency_key = ${`dispute-settlement:${dispute.id}`}`;
  expect(count).toBe(1);
  await sql.end();
});
