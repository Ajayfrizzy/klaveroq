import { expect, request, test, type APIRequestContext } from "@playwright/test";
import postgres from "postgres";

const baseURL = "http://127.0.0.1:3199";
const password = "KlaveroqTest123";
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://klaveroq_test:klaveroq_test@127.0.0.1:55434/klaveroq_test";

type Account = { api: APIRequestContext; cookie: string; id: string; email: string };

async function account(email: string, displayName: string, publish = false): Promise<Account> {
  const sql = postgres(testDatabaseUrl, { max: 1 });
  await sql`delete from auth_rate_limits where action = 'register'`;
  await sql.end();
  const bootstrap = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  const registered = await bootstrap.post("/api/auth/register", {
    data: { email, displayName, password },
  });
  expect(registered.status()).toBe(201);
  const cookie = registered.headers()["set-cookie"]?.split(";")[0];
  expect(cookie).toBeTruthy();
  await bootstrap.dispose();
  const api = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL, Cookie: cookie! },
  });
  const profile = await api.patch("/api/profile", {
    data: {
      displayName,
      headline: "Phase Six database specialist",
      bio: "I deliver reliable production systems with explicit evidence and measurable outcomes.",
      primaryRole: "Database specialist",
      skills: ["postgresql", "typescript"],
      experienceLevel: "EXPERT",
      yearsExperience: 6,
      languages: ["english"],
      availability: "AVAILABLE",
      timezone: "Africa/Lagos",
      countryCode: "NG",
      preferredWorkCategories: ["DEVELOPMENT"],
    },
  });
  expect(profile.ok()).toBeTruthy();
  if (publish)
    expect((await api.patch("/api/profile/visibility", { data: { isPublic: true } })).ok()).toBe(
      true,
    );
  const db = postgres(testDatabaseUrl, { max: 1 });
  const [user] = await db<{ id: string }[]>`select id from users where email = ${email}`;
  await db`update users set email_verified_at = now(), status = 'ACTIVE' where id = ${user.id}`;
  await db.end();
  return { api, cookie: cookie!, id: user.id, email };
}

async function listing(
  sql: postgres.Sql<Record<string, unknown>>,
  ownerId: string,
  title: string,
  publishedAt: Date,
  budget = "500000000",
) {
  const [record] = await sql<{ id: string }[]>`
    insert into job_listings (
      client_user_id, title, description, category, skills, budget_min, budget_max,
      proposal_deadline, status, published_at
    ) values (
      ${ownerId}, ${title},
      'A production-scale pagination fixture with enough detail to satisfy listing validation.',
      'DEVELOPMENT', ${sql.json(["postgresql", "typescript"])}, ${budget}, ${budget},
      ${new Date(Date.now() + 7 * 86_400_000)}, 'OPEN', ${publishedAt}
    ) returning id
  `;
  return record.id;
}

async function getJson(api: APIRequestContext, path: string) {
  const response = await api.get(path);
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test("Phase 6 discovery, talent ranking, workspace filters, and authorization", async ({
  page,
}) => {
  const suffix = Date.now();
  const client = await account(`phase6-client-${suffix}@example.test`, "Phase Six Client");
  const talents = await Promise.all(
    [1, 2, 3, 4].map((number) =>
      account(`phase6-talent-${number}-${suffix}@example.test`, `Phase Six Talent ${number}`, true),
    ),
  );
  const privateTalent = await account(
    `phase6-private-${suffix}@example.test`,
    "Phase Six Talent Private",
  );
  const anonymous = await request.newContext({ baseURL });
  const sql = postgres(testDatabaseUrl, { max: 1 });

  const sharedDate = new Date("2026-06-15T12:00:00.000Z");
  const dateIds = [];
  for (let index = 1; index <= 4; index += 1)
    dateIds.push(await listing(sql, client.id, `Phase6 Date Cursor ${index}`, sharedDate));
  const datePageOne = await getJson(
    anonymous,
    "/api/marketplace/listings?query=Phase6%20Date%20Cursor&limit=2",
  );
  expect(datePageOne.data).toHaveLength(2);
  expect(datePageOne.nextCursor).toBeTruthy();
  const firstDateIds = datePageOne.data.map(
    (record: { listing: { id: string } }) => record.listing.id,
  );
  await sql`delete from job_listings where id = ${firstDateIds[0]}`;
  const insertedAfterPageOne = await listing(
    sql,
    client.id,
    "Phase6 Date Cursor New",
    new Date("2026-06-16T12:00:00.000Z"),
  );
  const datePageTwo = await getJson(
    anonymous,
    `/api/marketplace/listings?query=Phase6%20Date%20Cursor&limit=2&cursor=${encodeURIComponent(datePageOne.nextCursor)}`,
  );
  const secondDateIds = datePageTwo.data.map(
    (record: { listing: { id: string } }) => record.listing.id,
  );
  expect(secondDateIds).toHaveLength(2);
  expect(secondDateIds).not.toContain(insertedAfterPageOne);
  expect(secondDateIds.some((id: string) => firstDateIds.includes(id))).toBe(false);

  for (let index = 1; index <= 4; index += 1)
    await listing(sql, client.id, `Phase6 Budget Cursor ${index}`, sharedDate, "900000000");
  const budgetPageOne = await getJson(
    anonymous,
    "/api/marketplace/listings?query=Phase6%20Budget%20Cursor&sort=budget&limit=2",
  );
  const budgetPageTwo = await getJson(
    anonymous,
    `/api/marketplace/listings?query=Phase6%20Budget%20Cursor&sort=budget&limit=2&cursor=${encodeURIComponent(budgetPageOne.nextCursor)}`,
  );
  const budgetIds = [...budgetPageOne.data, ...budgetPageTwo.data].map(
    (record: { listing: { id: string } }) => record.listing.id,
  );
  expect(new Set(budgetIds).size).toBe(4);

  expect((await anonymous.get("/api/marketplace/listings?cursor=malformed")).status()).toBe(400);
  const visibilityId = dateIds.find((id) => id !== firstDateIds[0])!;
  await sql`update job_listings set status = 'CLOSED', closed_at = now() where id = ${visibilityId}`;
  expect((await anonymous.get(`/api/marketplace/listings/${visibilityId}`)).status()).toBe(200);
  await sql`update job_listings set status = 'CANCELLED' where id = ${visibilityId}`;
  expect((await anonymous.get(`/api/marketplace/listings/${visibilityId}`)).status()).toBe(404);
  expect((await client.api.get(`/api/marketplace/listings/${visibilityId}`)).status()).toBe(200);

  const talentDate = new Date("2026-06-20T12:00:00.000Z");
  for (const [index, talent] of talents.entries()) {
    const [job] = await sql<{ id: string }[]>`
      insert into jobs (
        reference, client_user_id, worker_user_id, worker_email, title, description,
        subtotal, client_fee, network_reserve, status, completed_at
      ) values (
        ${`PH6-${suffix}-${index}`}, ${client.id}, ${talent.id}, ${talent.email},
        ${`Phase6 completed work ${index}`}, 'Completed work used to verify global talent ranking.',
        100000000, 0, 0, 'COMPLETED', now()
      ) returning id
    `;
    await sql`
      insert into marketplace_reviews (job_id, reviewer_user_id, subject_user_id, rating, comment)
      values (${job.id}, ${client.id}, ${talent.id}, ${index < 2 ? 5 : 4 - (index - 2)}, 'Verified work')
    `;
  }
  await sql`
    update profiles set updated_at = ${talentDate}
    where user_id in ${sql(talents.map((talent) => talent.id))}
  `;
  const talentPageOne = await getJson(
    anonymous,
    "/api/talent?query=Phase%20Six%20Talent&minCompletedJobs=1&limit=2",
  );
  const talentPageTwo = await getJson(
    anonymous,
    `/api/talent?query=Phase%20Six%20Talent&minCompletedJobs=1&limit=2&cursor=${encodeURIComponent(talentPageOne.nextCursor)}`,
  );
  expect(
    talentPageOne.data.map(
      (record: { reputation: { averageRating: number } }) => record.reputation.averageRating,
    ),
  ).toEqual([5, 5]);
  const talentIds = [...talentPageOne.data, ...talentPageTwo.data].map(
    (record: { profile: { userId: string } }) => record.profile.userId,
  );
  expect(new Set(talentIds).size).toBe(4);
  expect(talentIds).not.toContain(privateTalent.id);
  expect((await anonymous.get("/api/talent?cursor=malformed")).status()).toBe(400);

  const searchableListing = await listing(sql, client.id, "Phase6 Workspace Needle", sharedDate);
  const [proposal] = await sql<{ id: string }[]>`
    insert into proposals (
      listing_id, worker_user_id, cover_letter, total_bid, estimated_duration_days
    ) values (
      ${searchableListing}, ${talents[0].id},
      'Phase6 proposal needle with sufficient detail for the workspace search fixture.',
      500000000, 7
    ) returning id
  `;
  await sql`
    insert into proposal_milestones (
      proposal_id, sequence, title, description, acceptance_criteria, amount,
      evidence_requirements, delivery_days
    ) values (
      ${proposal.id}, 1, 'Searchable milestone', 'Deliver the complete searchable result.',
      'The result is visible in the proposal evaluation.', 500000000, 'Automated evidence', 7
    )
  `;
  const evaluationResponse = await client.api.get(
    `/api/marketplace/listings/${searchableListing}/proposals`,
  );
  expect(evaluationResponse.status()).toBe(200);
  expect((await evaluationResponse.json()).data[0].milestones).toHaveLength(1);
  expect(
    (
      await privateTalent.api.get(`/api/marketplace/listings/${searchableListing}/proposals`)
    ).status(),
  ).toBe(404);

  const [cookieName, cookieValue] = client.cookie.split("=");
  await page.context().addCookies([{ name: cookieName, value: cookieValue, url: baseURL }]);
  await page.goto("/jobs?view=listings&query=Workspace%20Needle");
  await expect(page.getByText("Phase6 Workspace Needle", { exact: true })).toBeVisible();
  await expect(page.getByText("Phase6 Budget Cursor 1", { exact: true })).toHaveCount(0);
  await page.goto("/discover?query=Phase6%20Budget%20Cursor&sort=budget&limit=2");
  await expect(page.locator(".listing-card")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Next page" })).toBeVisible();
  await page.goto("/discover?cursor=malformed");
  await expect(page).toHaveURL(`${baseURL}/discover`);
  await page.goto("/discover?query=NoSuchPhase6Listing");
  await expect(page.getByRole("heading", { name: "No matching jobs" })).toBeVisible();

  const [talentCookieName, talentCookieValue] = talents[0].cookie.split("=");
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([{ name: talentCookieName, value: talentCookieValue, url: baseURL }]);
  await page.goto("/jobs?view=proposals&query=proposal%20needle");
  await expect(page.getByText("Phase6 Workspace Needle", { exact: true })).toBeVisible();
  await page.goto("/talent?query=Phase%20Six%20Talent&minCompletedJobs=1&limit=2");
  await expect(page.locator(".talent-card")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Next page" })).toBeVisible();
  await page.goto("/talent?cursor=malformed");
  await expect(page).toHaveURL(`${baseURL}/talent`);

  await sql.end();
  await anonymous.dispose();
  await client.api.dispose();
  await privateTalent.api.dispose();
  for (const talent of talents) await talent.api.dispose();
});
