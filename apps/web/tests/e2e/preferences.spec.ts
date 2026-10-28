import { expect, test, type APIRequestContext } from "@playwright/test";
import postgres from "postgres";
import { sessionRequest } from "./preference-test-session";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3199";
const headers = { Origin: origin };
const password = "KlaveroqTest123";
function database() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test"))
    throw new Error("Explicit isolated test database required");
  return postgres(url, { max: 1 });
}
async function account(request: APIRequestContext) {
  const sql = database();
  await sql`delete from auth_rate_limits where action = 'register'`;
  await sql.end();
  const email = `preferences-${crypto.randomUUID()}@example.test`;
  const response = await request.post("/api/auth/register", {
    headers,
    data: { email, password, displayName: "Preference Tester" },
  });
  expect(response.status()).toBe(201);
  return { id: (await response.json()).data.user.id as string, email };
}
async function publicTalent() {
  const sql = database();
  const ids: string[] = [];
  for (let i = 0; i < 4; i++) {
    const email = "talent-" + crypto.randomUUID() + "@example.test";
    const [user] = await sql`insert into users (email) values (${email}) returning id`;
    await sql`insert into profiles (user_id, display_name, is_public) values (${user.id}, 'Preference Talent', true)`;
    ids.push(user.id);
  }
  await sql.end();
  return ids;
}
async function preferences(request: APIRequestContext) {
  request = sessionRequest(request);
  const response = await request.get("/api/preferences");
  expect(response.status()).toBe(200);
  return (await response.json()).data;
}

test("preference APIs enforce ownership, canonical duplicates and concurrent database limits", async ({
  page,
  playwright,
}) => {
  const anonymous = await playwright.request.newContext({ baseURL: origin });
  const other = await playwright.request.newContext({ baseURL: origin });
  try {
    for (const route of ["", "/saved-searches", "/talent-shortlist"])
      expect((await anonymous.get("/api/preferences" + route)).status()).toBe(401);
    const owner = await account(sessionRequest(page.request));
    await account(other);
    expect(await preferences(sessionRequest(page.request))).toMatchObject({
      workspaceFocus: "both",
      hasWorkspaceFocus: false,
      searches: [],
      talentIds: [],
    });
    expect(
      (
        await sessionRequest(page.request).patch("/api/preferences", {
          headers: { Origin: "https://evil.test" },
          data: { workspaceFocus: "hire" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await sessionRequest(page.request).patch("/api/preferences", {
          headers,
          data: { workspaceFocus: "hire", userId: owner.id },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await sessionRequest(page.request).post("/api/preferences/saved-searches", {
          headers,
          data: { scope: "talent", name: "bad", parameters: { redirect: "https://evil.test" } },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await sessionRequest(page.request).post("/api/preferences/saved-searches", {
          headers,
          data: {
            scope: "discover",
            name: "bad",
            parameters: { minBudget: "100", maxBudget: "1" },
          },
        })
      ).status(),
    ).toBe(400);
    const create = (i: number) =>
      sessionRequest(page.request).post("/api/preferences/saved-searches", {
        headers,
        data: { scope: "talent", name: "Search " + i, parameters: { query: "design-" + i } },
      });
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => create(i)));
    expect(results.filter((r) => r.status() === 200)).toHaveLength(8);
    expect(results.filter((r) => r.status() === 409)).toHaveLength(4);
    const constraints = database();
    try {
      await expect(
        constraints`insert into saved_searches (user_id, scope, name, query, slot) values (${owner.id}, 'talent', 'Overflow', 'query=overflow', 8)`,
      ).rejects.toMatchObject({ code: "23514" });
    } finally {
      await constraints.end();
    }
    const failedImport = await sessionRequest(page.request).post("/api/preferences/import", {
      headers,
      data: {
        workspaceFocus: "hire",
        searches: [{ scope: "talent", name: "Ninth", parameters: { query: "overflow" } }],
      },
    });
    expect(failedImport.status()).toBe(409);
    expect((await preferences(page.request)).hasWorkspaceFocus).toBe(false);
    const saved = (await preferences(sessionRequest(page.request))).searches;
    const query = Object.fromEntries(new URL(saved[0].url, origin).searchParams);
    expect(
      (
        await sessionRequest(page.request).post("/api/preferences/saved-searches", {
          headers,
          data: {
            scope: "talent",
            name: "Renamed",
            parameters: { ...query, sort: "reputation", minCompletedJobs: "0" },
          },
        })
      ).status(),
    ).toBe(200);
    expect((await preferences(sessionRequest(page.request))).searches).toHaveLength(8);
    expect((await sessionRequest(other).get("/api/preferences?userId=" + owner.id)).status()).toBe(
      200,
    );
    expect((await preferences(sessionRequest(other))).searches).toHaveLength(0);
    await sessionRequest(other).delete("/api/preferences/saved-searches", {
      headers,
      data: { id: saved[0].id },
    });
    expect((await preferences(sessionRequest(page.request))).searches).toHaveLength(8);
    expect(
      (
        await sessionRequest(page.request).post("/api/preferences/saved-searches", {
          headers,
          data: { scope: "discover", name: "Work", parameters: {} },
        })
      ).status(),
    ).toBe(200);
    await sessionRequest(page.request).delete("/api/preferences/saved-searches", {
      headers,
      data: { id: saved[0].id },
    });
    expect(
      (await preferences(sessionRequest(page.request))).searches.filter(
        (s: { scope: string }) => s.scope === "talent",
      ),
    ).toHaveLength(7);
    const ids = await publicTalent();
    expect(
      (
        await sessionRequest(page.request).post("/api/preferences/talent-shortlist", {
          headers,
          data: { talentUserId: owner.id.toUpperCase() },
        })
      ).status(),
    ).toBe(400);
    const shortlist = await Promise.all(
      ids.map((talentUserId) =>
        sessionRequest(page.request).post("/api/preferences/talent-shortlist", {
          headers,
          data: { talentUserId },
        }),
      ),
    );
    expect(shortlist.filter((r) => r.status() === 200)).toHaveLength(3);
    expect(shortlist.filter((r) => r.status() === 409)).toHaveLength(1);
    const selected = (await preferences(sessionRequest(page.request))).talentIds;
    await sessionRequest(other).delete("/api/preferences/talent-shortlist", {
      headers,
      data: { talentUserId: selected[0] },
    });
    expect((await preferences(sessionRequest(page.request))).talentIds).toHaveLength(3);
    expect(
      (
        await sessionRequest(page.request).post("/api/preferences/talent-shortlist", {
          headers,
          data: { talentUserId: selected[0] },
        })
      ).status(),
    ).toBe(200);
    const sql = database();
    await sql`update profiles set is_public = false where user_id = ${selected[0]}`;
    await sql.end();
    await page.goto("/talent");
    await page.getByRole("button", { name: "View shortlist & compare" }).click();
    await expect(page.getByRole("table")).toContainText("Profile no longer available");
    await page.getByRole("button", { name: "Remove unavailable profile from shortlist" }).click();
    await expect
      .poll(async () => (await preferences(sessionRequest(page.request))).talentIds.length)
      .toBe(2);
    expect(
      (
        await sessionRequest(page.request).post("/api/preferences/talent-shortlist", {
          headers,
          data: { talentUserId: selected[0] },
        })
      ).status(),
    ).toBe(404);
  } finally {
    await anonymous.dispose();
    await other.dispose();
  }
});

test("workspace, searches and shortlist follow the account across refresh, login and another browser", async ({
  page,
  browser,
}) => {
  const user = await account(sessionRequest(page.request));
  const [talentUserId] = await publicTalent();
  await page.goto("/dashboard");
  const hire = page.getByRole("button", { name: "Hire talent", exact: true });
  await page.route("**/api/preferences", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 503,
          json: { error: { message: "Unable to save now. Try again." } },
        })
      : route.continue(),
  );
  await hire.click();
  await expect(page.locator(".intent-panel [role=alert]")).toContainText("Unable to save now");
  await expect(page.getByRole("button", { name: "Both", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.unroute("**/api/preferences");
  await hire.click();
  await expect
    .poll(async () => (await preferences(sessionRequest(page.request))).workspaceFocus)
    .toBe("hire");
  await page.reload();
  await expect(hire).toHaveAttribute("aria-pressed", "true");
  await page.goto("/discover?query=account-search");
  await page.getByText("Saved searches (0)", { exact: true }).click();
  await page.getByLabel("Search name", { exact: true }).fill("Account search");
  await page.getByRole("button", { name: "Save current search" }).click();
  await expect(page.getByRole("link", { name: "Account search", exact: true })).toBeVisible();
  await sessionRequest(page.request).post("/api/preferences/talent-shortlist", {
    headers,
    data: { talentUserId },
  });
  await sessionRequest(page.request).post("/api/auth/logout", { headers });
  expect((await sessionRequest(page.request).get("/api/preferences")).status()).toBe(401);
  expect(
    (
      await sessionRequest(page.request).post("/api/auth/login", {
        headers,
        data: { email: user.email, password },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/dashboard");
  await expect(hire).toHaveAttribute("aria-pressed", "true");
  const second = await browser.newContext();
  try {
    const otherPage = await second.newPage();
    expect(
      (
        await second.request.post(origin + "/api/auth/login", {
          headers,
          data: { email: user.email, password },
        })
      ).status(),
    ).toBe(200);
    await otherPage.goto(origin + "/dashboard");
    await expect(
      otherPage.getByRole("button", { name: "Hire talent", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await otherPage.goto(origin + "/discover");
    await otherPage.getByText("Saved searches (1)", { exact: true }).click();
    await expect(
      otherPage.getByRole("link", { name: "Account search", exact: true }),
    ).toBeVisible();
    await otherPage.getByRole("button", { name: "Remove saved search Account search" }).click();
    await expect(otherPage.getByText("Saved searches (0)", { exact: true })).toBeVisible();
    await otherPage.goto(origin + "/talent");
    await expect(otherPage.getByRole("region", { name: "Talent shortlist" })).toContainText("1/3");
  } finally {
    await second.close();
  }
});

test("device migration is opt-in, preserves declined data and retries safely", async ({ page }) => {
  const user = await account(sessionRequest(page.request));
  const [talentUserId] = await publicTalent();
  await page.goto("/dashboard");
  await page.evaluate(
    ({ id, talentUserId }) => {
      localStorage.setItem(`klaveroq:intent:${id}`, "work");
      localStorage.setItem(
        `klaveroq:searches:${id}:/discover`,
        JSON.stringify([{ name: "Device search", url: "/discover?query=legacy" }]),
      );
      localStorage.setItem(`klaveroq:shortlist:${id}`, JSON.stringify([talentUserId]));
    },
    { id: user.id, talentUserId },
  );
  await page.reload();
  await expect(page.getByRole("region", { name: "Import device preferences" })).toBeVisible();
  expect((await preferences(sessionRequest(page.request))).hasWorkspaceFocus).toBe(false);
  await page.getByRole("button", { name: "Not now", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("region", { name: "Import device preferences" })).toHaveCount(0);
  expect(await page.evaluate((id) => localStorage.getItem(`klaveroq:intent:${id}`), user.id)).toBe(
    "work",
  );
  await page.evaluate((id) => sessionStorage.removeItem(`klaveroq:import-declined:${id}`), user.id);
  await page.reload();
  await page.route("**/api/preferences/import", (route) =>
    route.fulfill({ status: 503, json: { error: { message: "Please try again." } } }),
  );
  await page.getByRole("button", { name: "Save to my account" }).click();
  await expect(
    page.getByRole("region", { name: "Import device preferences" }).getByRole("alert"),
  ).toContainText("Please try again.");
  expect(await page.evaluate((id) => localStorage.getItem(`klaveroq:intent:${id}`), user.id)).toBe(
    "work",
  );
  await page.unroute("**/api/preferences/import");
  await page.getByRole("button", { name: "Save to my account" }).click();
  await expect(page.getByRole("region", { name: "Import device preferences" })).toHaveCount(0);
  expect(await preferences(sessionRequest(page.request))).toMatchObject({
    workspaceFocus: "work",
    talentIds: [talentUserId],
  });
  expect((await preferences(sessionRequest(page.request))).searches).toHaveLength(1);
  expect(
    await page.evaluate((id) => localStorage.getItem(`klaveroq:intent:${id}`), user.id),
  ).toBeNull();
  expect(
    (
      await sessionRequest(page.request).post("/api/preferences/import", {
        headers,
        data: {
          workspaceFocus: "hire",
          searches: [
            {
              scope: "discover",
              name: "Duplicate",
              parameters: { query: "legacy", sort: "newest" },
            },
          ],
          talentIds: [talentUserId],
        },
      })
    ).status(),
  ).toBe(200);
  expect(await preferences(sessionRequest(page.request))).toMatchObject({
    workspaceFocus: "work",
    talentIds: [talentUserId],
  });
  expect((await preferences(sessionRequest(page.request))).searches).toHaveLength(1);
});

test("malformed legacy keys never offer an import", async ({ page }) => {
  const user = await account(sessionRequest(page.request));
  await page.goto("/dashboard");
  await page.evaluate((id) => {
    localStorage.setItem(`klaveroq:intent:${id}`, "administrator");
    localStorage.setItem(
      `klaveroq:searches:${id}:/discover`,
      JSON.stringify([{ name: "Unsafe", url: "https://evil.test" }]),
    );
    localStorage.setItem(`klaveroq:shortlist:${id}`, '["not-a-uuid"]');
  }, user.id);
  await page.reload();
  await expect(page.getByRole("button", { name: "Both", exact: true })).toBeEnabled();
  await expect(page.getByRole("region", { name: "Import device preferences" })).toHaveCount(0);
  expect(await preferences(sessionRequest(page.request))).toMatchObject({
    hasWorkspaceFocus: false,
    searches: [],
    talentIds: [],
  });
});
