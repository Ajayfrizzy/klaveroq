import { expect, request, test, type APIRequestContext } from "@playwright/test";
import postgres from "postgres";

const baseURL = "http://127.0.0.1:3199";
const password = "KlaveroqTest123";
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://klaveroq_test:klaveroq_test@127.0.0.1:55434/klaveroq_test";

async function freshAccount(email: string, displayName: string) {
  const bootstrap = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  const registered = await bootstrap.post("/api/auth/register", {
    data: { email, displayName, password },
  });
  expect(registered.status()).toBe(201);
  const userId = (await registered.json()).data.user.id as string;
  const session = registered.headers()["set-cookie"]?.split(";")[0];
  expect(session).toBeTruthy();
  const sql = postgres(testDatabaseUrl, { max: 1 });
  await sql`update users set email_verified_at = now(), status = 'ACTIVE' where id = ${userId}`;
  await sql.end();
  await bootstrap.dispose();
  return {
    userId,
    api: await request.newContext({
      baseURL,
      extraHTTPHeaders: { Origin: baseURL, Cookie: session! },
    }),
  };
}

async function profile(api: APIRequestContext) {
  const response = await api.get("/api/profile");
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data.profile;
}

test("fresh Google-equivalent profiles support gradual private completion and guarded publishing", async () => {
  const suffix = Date.now();
  const email = `google-equivalent-${suffix}@example.test`;
  const owner = await freshAccount(email, "Fresh Google User");
  const other = await freshAccount(`profile-other-${suffix}@example.test`, "Other Profile");
  const sql = postgres(testDatabaseUrl, { max: 1 });
  await sql`insert into auth_identities (user_id, provider, provider_subject, provider_email)
            values (${owner.userId}, 'google', ${`google-subject-${suffix}`}, ${email})`;

  expect(await profile(owner.api)).toEqual(
    expect.objectContaining({
      displayName: "Fresh Google User",
      headline: null,
      bio: null,
      primaryRole: null,
      skills: [],
      experienceLevel: null,
      countryCode: null,
      timezone: null,
      isPublic: false,
    }),
  );

  const nameOnly = await owner.api.patch("/api/profile", {
    data: { displayName: "Fresh Name Saved" },
  });
  expect(nameOnly.status()).toBe(200);
  expect((await nameOnly.json()).data).toEqual(
    expect.objectContaining({ displayName: "Fresh Name Saved", headline: null, isPublic: false }),
  );

  const partial = await owner.api.patch("/api/profile", {
    data: { primaryRole: "Product engineer" },
  });
  expect(partial.status()).toBe(200);
  expect((await profile(owner.api)).primaryRole).toBe("Product engineer");

  const incompletePublish = await owner.api.patch("/api/profile/visibility", {
    data: { isPublic: true },
  });
  expect(incompletePublish.status()).toBe(422);
  expect((await incompletePublish.json()).error.code).toBe("PROFILE_INCOMPLETE");

  const targetInjection = await owner.api.patch("/api/profile", {
    data: { displayName: "Unauthorized edit", userId: other.userId },
  });
  expect(targetInjection.status()).toBe(400);
  expect((await profile(other.api)).displayName).toBe("Other Profile");
  expect((await profile(owner.api)).displayName).toBe("Fresh Name Saved");

  const complete = await owner.api.patch("/api/profile", {
    data: {
      headline: "Marketplace product engineer",
      bio: "I build dependable marketplace workflows with accessible interfaces and carefully tested persistence.",
      skills: ["TypeScript", "testing"],
      experienceLevel: "EXPERT",
      countryCode: "ng",
      timezone: "Africa/Lagos",
    },
  });
  expect(complete.status()).toBe(200);
  expect(
    (await owner.api.patch("/api/profile/visibility", { data: { isPublic: true } })).status(),
  ).toBe(200);

  const publishedEdit = await owner.api.patch("/api/profile", {
    data: { displayName: "Published Name" },
  });
  expect(publishedEdit.status()).toBe(200);
  expect((await publishedEdit.json()).data.isPublic).toBe(true);

  const invalidPublishedEdit = await owner.api.patch("/api/profile", {
    data: { headline: null },
  });
  expect(invalidPublishedEdit.status()).toBe(409);
  expect((await invalidPublishedEdit.json()).error.code).toBe("PROFILE_WOULD_BE_INCOMPLETE");
  expect(await profile(owner.api)).toEqual(
    expect.objectContaining({ headline: "Marketplace product engineer", isPublic: true }),
  );

  const makePrivate = await owner.api.patch("/api/profile", {
    data: { headline: null, makePrivateIfIncomplete: true },
  });
  expect(makePrivate.status()).toBe(200);
  expect((await makePrivate.json()).data).toEqual(
    expect.objectContaining({ headline: null, isPublic: false }),
  );

  const [counts] = await sql`
    select
      (select count(*)::int from users where id = ${owner.userId}) users,
      (select count(*)::int from profiles where user_id = ${owner.userId}) profiles,
      (select count(*)::int from auth_identities where user_id = ${owner.userId} and provider = 'google') identities
  `;
  expect(counts).toEqual({ users: 1, profiles: 1, identities: 1 });
  await sql.end();
  await owner.api.dispose();
  await other.api.dispose();
});
