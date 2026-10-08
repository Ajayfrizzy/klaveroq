import { createHash } from "node:crypto";
import { expect, test, type APIResponse } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import postgres from "postgres";
import { sessionRequest } from "./preference-test-session";

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://klaveroq_test:klaveroq_test@127.0.0.1:55434/klaveroq_test";
const parsed = new URL(databaseUrl);
if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || !parsed.pathname.endsWith("_test"))
  throw new Error("Isolated test database required");
const sql = postgres(databaseUrl, { max: 1 });
const marker = `PublicDemo${Date.now()}`;
const privateName = `${marker} PRIVATE SECRET`;
const publicIds: string[] = [];
const privateId = crypto.randomUUID();
const listingId = crypto.randomUUID();
const draftId = crypto.randomUUID();
const hiddenEmail = `${privateId}@example.test`;

test.beforeAll(async () => {
  // Only disposable test fixtures; never writes to the beta database.
  for (let i = 0; i < 29; i++) {
    const id = i === 28 ? privateId : crypto.randomUUID();
    if (i !== 28) publicIds.push(id);
    await sql`insert into users (id, email, status) values (${id}, ${`${id}@example.test`}, 'ACTIVE')`;
    await sql`insert into profiles (user_id, display_name, headline, bio, primary_role, skills, experience_level, country_code, timezone, is_public)
      values (${id}, ${i === 28 ? privateName : `${marker} Professional ${i}`}, ${i === 0 ? "Exact specialist" : i === 1 ? "Exactskill product engineer" : "Independent product engineer"},
      'I create thoughtful digital products with clear milestones and evidence of delivery.', 'Product engineer', ${sql.json([marker.toLowerCase(), ...(i === 0 ? ["exactskill"] : ["react"])])}, 'EXPERT', 'NG', 'Africa/Lagos', ${i !== 28})`;
  }
  for (const [id, status] of [
    [listingId, "OPEN"],
    [draftId, "DRAFT"],
  ]) {
    await sql`insert into job_listings (id, client_user_id, title, description, category, skills, budget_min, budget_max, proposal_deadline, status, published_at)
      values (${id}, ${privateId}, ${status === "OPEN" ? `${marker} Product design opportunity` : `${marker} HIDDEN DRAFT`}, 'Design an accessible product experience with clear milestones and documented delivery.', 'DESIGN', '["design"]', 100000000, 200000000, now() + interval '10 days', ${status}, ${status === "OPEN" ? new Date() : null})`;
  }
});
test.afterAll(async () => {
  await sql`delete from job_listings where id in (${listingId}, ${draftId})`;
  await sql`delete from users where id in ${sql([privateId, ...publicIds] as [string, ...string[]])}`;
  await sql.end();
});

test("anonymous landing, jobs and talent render real public data without private payloads", async ({
  page,
}) => {
  for (const path of ["/", "/jobs", "/talent"]) {
    const response = await page.goto(path);
    expect(response?.ok()).toBeTruthy();
    const html = await response!.text();
    expect(html).not.toContain(privateName);
    expect(html).not.toContain(hiddenEmail);
    expect(html).not.toContain(`${marker} HIDDEN DRAFT`);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  }
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Work with people you can trust." }),
  ).toBeVisible();
  expect(await page.locator(".home-talent-card").count()).toBe(6);
  await expect(page.getByRole("link", { name: "Browse all talent" })).toBeVisible();
  await expect(page.locator(".home-talent-card").first()).toContainText("New on Klaveroq");
});

test("pagination, relevance, unpublishing and direct routes enforce publication at every read", async ({
  request,
}) => {
  let cursor: string | null = null;
  const seen: string[] = [];
  do {
    const response: APIResponse = await request.get(
      `/api/talent?skill=${marker.toLowerCase()}${cursor ? `&cursor=${cursor}` : ""}`,
    );
    expect(response.ok()).toBeTruthy();
    const body: {
      data: {
        profile: { userId: string };
        reputation: { averageRating: number | null; completedJobs: number };
      }[];
      nextCursor: string | null;
    } = await response.json();
    expect(body.data.length).toBeLessThanOrEqual(24);
    if (!cursor) expect(body.data.length).toBe(24);
    for (const item of body.data) {
      expect(item.profile).not.toHaveProperty("email");
      expect(item.profile).not.toHaveProperty("avatarKey");
      expect(item.reputation.averageRating).toBeNull();
      expect(item.reputation.completedJobs).toBe(0);
      seen.push(item.profile.userId);
    }
    cursor = body.nextCursor;
  } while (cursor);
  expect(new Set(seen).size).toBe(28);
  expect(seen).toHaveLength(28);
  expect(seen).not.toContain(privateId);
  const first = await (await request.get(`/api/talent?query=exactskill`)).json();
  expect(first.data.map((item: { profile: { userId: string } }) => item.profile.userId)).toEqual([
    publicIds[0],
    publicIds[1],
  ]);
  const privateSearch = await (
    await request.get(`/api/talent?query=${encodeURIComponent(privateName)}`)
  ).json();
  expect(privateSearch.data).toEqual([]);
  for (const path of [
    `/api/talent/${privateId}`,
    `/talent/${privateId}`,
    "/talent/not-a-valid-id",
  ]) {
    const response = await request.get(path);
    // Next can stream a not-found UI after headers; the payload must still be private-safe.
    expect(await response.text()).not.toContain(privateName);
    if (path.startsWith("/api")) expect(response.status()).toBe(404);
  }
  await sql`update profiles set is_public = false where user_id = ${publicIds[0]}`;
  expect((await request.get(`/api/talent/${publicIds[0]}`)).status()).toBe(404);
  expect(
    (await (await request.get("/api/talent?query=exactskill")).json()).data.map(
      (item: { profile: { userId: string } }) => item.profile.userId,
    ),
  ).toEqual([publicIds[1]]);
  await sql`update profiles set is_public = true where user_id = ${publicIds[0]}`;
});

test("daily discovery is deterministic, rotates across days, and preserves relevance with alternate sorts", async ({
  request,
}) => {
  const idsFor = (seed: string) =>
    [...publicIds].sort((a, b) =>
      createHash("md5")
        .update(b + seed)
        .digest("hex")
        .localeCompare(
          createHash("md5")
            .update(a + seed)
            .digest("hex"),
        ),
    );
  const days = ["2026-10-07", "2026-10-08"];
  const firstIds: string[] = [];
  for (const seed of days) {
    // A cursor at the top of the keyspace exercises the exact server ranking for a fixed day.
    const cursor = Buffer.from(
      JSON.stringify({
        kind: "talent-discover",
        seed,
        rank: 0,
        value: "f".repeat(32),
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      }),
    ).toString("base64url");
    const url = `/api/talent?skill=${marker.toLowerCase()}&cursor=${cursor}`;
    const a = await (await request.get(url)).json();
    const b = await (await request.get(url)).json();
    expect(a).toEqual(b);
    expect(a.data.map((item: { profile: { userId: string } }) => item.profile.userId)).toEqual(
      idsFor(seed).slice(0, 24),
    );
    expect(JSON.parse(Buffer.from(a.nextCursor, "base64url").toString()).seed).toBe(seed);
    firstIds.push(
      a.data.map((item: { profile: { userId: string } }) => item.profile.userId).join(","),
    );
  }
  expect(firstIds[0]).not.toBe(firstIds[1]);
  for (const sort of ["recent", "completed", "reputation"]) {
    const result = await (
      await request.get(`/api/talent?query=exactskill&sort=${sort}&limit=1`)
    ).json();
    expect(result.data[0].profile.userId).toBe(publicIds[0]);
    const next = await (
      await request.get(
        `/api/talent?query=exactskill&sort=${sort}&limit=1&cursor=${result.nextCursor}`,
      )
    ).json();
    expect(next.data[0].profile.userId).toBe(publicIds[1]);
  }
});

test("public job details mask private clients and preserve the apply and registration destination", async ({
  page,
  request,
}) => {
  const response = await page.goto(`/jobs/${listingId}`);
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator("h1")).toHaveText(`${marker} Product design opportunity`);
  expect(await response!.text()).not.toContain(privateName);
  await expect(page).toHaveTitle(`${marker} Product design opportunity | Klaveroq`);
  await page.getByRole("link", { name: "Sign in to apply" }).click();
  await expect(page).toHaveURL(/\/login\?/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(`/jobs/${listingId}`);
  await page.getByRole("link", { name: "Register", exact: true }).click();
  await expect(page).toHaveURL(/\/register\?/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(`/jobs/${listingId}`);
  expect((await request.get(`/api/marketplace/listings/${draftId}`)).status()).toBe(404);
  const draftPage = await request.get(`/jobs/${draftId}`);
  expect(await draftPage.text()).not.toContain(`${marker} HIDDEN DRAFT`);
  const payload = await (await request.get(`/api/marketplace/listings/${listingId}`)).json();
  expect(payload.data.client.displayName).toBe("Klaveroq client");
  expect(payload.data.client.bio).toBeNull();
  expect(payload.data.listing).not.toHaveProperty("clientUserId");
});

test("account actions require authentication and profile reputation stays honest", async ({
  page,
  request,
  baseURL,
}) => {
  for (const path of [
    "/jobs/new/public",
    "/jobs/new/direct",
    "/profile",
    "/dashboard",
    "/jobs?view=agreements",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?/);
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe(path);
  }
  await page.goto(`/talent/${publicIds[1]}`);
  await expect(page.getByText("Credentials not connected", { exact: true })).toBeVisible();
  await expect(page.locator(".reputation-score strong")).toHaveText("New");
  await page.getByRole("link", { name: "Invite to a job" }).click();
  await expect(page).toHaveURL(/\/login\?/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(
    `/jobs/new/direct?talent=${publicIds[1]}`,
  );
  await page.goto("/talent");
  await page.getByRole("link", { name: "Sign in to shortlist" }).first().click();
  await expect(page).toHaveURL(/\/login\?/);
  await page.goto("/jobs");
  await page.getByRole("link", { name: "Sign in to save searches" }).click();
  await expect(page).toHaveURL(/\/login\?/);
  for (const path of [
    "/api/preferences/talent-shortlist",
    `/api/marketplace/listings/${listingId}/proposals`,
    "/api/marketplace/listings",
  ]) {
    const response = await request.post(path, {
      headers: { Origin: new URL(baseURL!).origin, "Idempotency-Key": crypto.randomUUID() },
      data: {},
    });
    expect(response.status()).toBe(401);
  }
});

test("signed-in users retain workspace access and can browse the public homepage", async ({
  page,
  baseURL,
}) => {
  const api = sessionRequest(page.request);
  const response = await api.post("/api/auth/register", {
    headers: { Origin: new URL(baseURL!).origin },
    data: {
      email: `public-workspace-${crypto.randomUUID()}@example.test`,
      password: "KlaveroqTest123",
      displayName: "Public Workspace",
    },
  });
  expect(response.status()).toBe(201);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Work with people you can trust." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome, Public" })).toBeVisible();
  await page.goto("/jobs?view=agreements");
  await expect(page.getByRole("link", { name: "Agreements", exact: true })).toBeVisible();
});

test("responsive public pages have no overflow, accessible content, and reduced-motion support", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path] of [
      ["home", "/"],
      ["jobs", "/jobs"],
      ["talent", "/talent"],
      ["profile", `/talent/${publicIds[1]}`],
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      if (name === "talent") await expect(page.locator(".talent-card").first()).toBeVisible();
      if (name === "home") await expect(page.locator(".home-talent-card").first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBeTruthy();
      const violations = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
        .violations;
      expect(violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
        [],
      );
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true });
    }
  }
  await page.goto("/");
  expect(
    await page
      .locator(".glass-card")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.getByText("Menu", { exact: true }).click();
  await expect(
    page
      .getByRole("navigation", { name: "Mobile marketplace navigation" })
      .getByRole("link", { name: "Find work" }),
  ).toBeVisible();
});

test("landing interactions preserve desktop layout, support keyboard browsing and respect motion preferences", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat/i.test(message.text())) errors.push(message.text());
  });
  await page.goto("/");
  await page.locator(".home-talent-card").first().waitFor();
  const layoutShift = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
            if (!shift.hadRecentInput) total += shift.value;
          }
        });
        observer.observe({ type: "layout-shift", buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(total);
        }, 500);
      }),
  );
  expect(layoutShift).toBeLessThan(0.1);
  await testInfo.attach("initial-layout-shift", {
    body: String(layoutShift),
    contentType: "text/plain",
  });
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const track = page.locator(".trust-notes");
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overflow: Array.from(document.querySelectorAll("main *"))
          .filter(
            (el) => el.getBoundingClientRect().right > innerWidth && !el.closest(".trust-notes"),
          )
          .map((el) => el.className),
      })),
    ).toEqual({ width, scrollWidth: width, overflow: [] });
    if (width <= 760) {
      await expect(page.locator(".trust-controls")).toBeVisible();
      await track.focus();
      await page.keyboard.press("End");
      await expect(page.locator(".trust-progress")).toHaveText("3 / 3");
      await page.getByRole("button", { name: "Show reputation principle 2 of 3" }).click();
      await expect(page.locator(".trust-progress")).toHaveText("2 / 3");
      await page.waitForTimeout(1100);
      await expect(page.locator(".trust-progress")).toHaveText("2 / 3");
      await track.focus();
      await page.keyboard.press("Home");
      await expect(page.locator(".trust-progress")).toHaveText("1 / 3");
      await expect(page.locator(".glass-card").first()).toHaveCSS("animation-name", "none");
      const menu = page.locator(".public-mobile-nav summary");
      await menu.click();
      await expect(
        page.getByRole("navigation", { name: "Mobile marketplace navigation" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(menu).toBeFocused();
    } else {
      await expect(page.locator(".trust-controls")).toBeHidden();
      expect(await track.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      await expect(page.locator(".trust-carousel")).not.toHaveAttribute(
        "aria-roledescription",
        "carousel",
      );
    }
    if ([375, 430, 768, 1024, 1440].includes(width)) {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.locator(".home-talent-card").first().waitFor();
      await page.evaluate(() => {
        (document.activeElement as HTMLElement)?.blur();
        window.scrollTo(0, 0);
      });
      await page.screenshot({ path: testInfo.outputPath(`homepage-${width}.png`), fullPage: true });
      const accessibility = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(accessibility.violations).toEqual([]);
      await page.emulateMedia({ reducedMotion: "no-preference" });
    }
  }
  const scene = page.locator(".hero-scene");
  await scene.scrollIntoViewIfNeeded();
  await scene.hover({ position: { x: 30, y: 30 } });
  await expect
    .poll(() => scene.evaluate((el) => el.style.getPropertyValue("--scene-x")))
    .not.toBe("");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => scene.evaluate((el) => el.style.getPropertyValue("--scene-x"))).toBe("");
  await expect(page.locator(".glass-card").first()).toHaveCSS("animation-name", "none");
  expect(errors).toEqual([]);
});
