import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { sessionRequest } from "./preference-test-session";

test("community beta disables identity without creating records or exposing sandbox verification", async ({
  page,
}) => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test"))
    throw new Error("Isolated database required");
  const sql = postgres(url, { max: 1 });
  const headers = { Origin: "http://127.0.0.1:3201" };
  try {
    expect((await sessionRequest(page.request).get("/api/identity")).status()).toBe(401);
    await sql`delete from auth_rate_limits where action = 'register'`;
    const response = await sessionRequest(page.request).post("/api/auth/register", {
      headers,
      data: {
        email: "beta-identity-" + crypto.randomUUID() + "@example.test",
        password: "KlaveroqTest123",
        displayName: "Beta Identity",
      },
    });
    expect(response.status()).toBe(201);
    const id = (await response.json()).data.user.id;
    await page.goto("/identity");
    await expect(
      page.getByRole("heading", { name: "Not available during community beta" }),
    ).toBeVisible();
    await expect(
      page.getByText("It is not required to participate in this testing phase.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Start identity check" })).toHaveCount(0);
    await expect(page.getByLabel("Country code")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Continue sandbox check" })).toHaveCount(0);
    const data = (await (await sessionRequest(page.request).get("/api/identity")).json()).data;
    expect(data).toMatchObject({ status: "NOT_STARTED", available: false, provider: null });
    const start = await sessionRequest(page.request).post("/api/identity", {
      headers,
      data: { countryCode: "NG" },
    });
    expect(start.status()).toBe(503);
    expect((await start.json()).error.code).toBe("IDENTITY_VERIFICATION_UNAVAILABLE");
    expect((await sql`select id from identity_verifications where user_id = ${id}`).length).toBe(0);
    expect(
      (
        await sessionRequest(page.request).post("/api/identity", {
          headers: { Origin: "https://evil.test" },
          data: { countryCode: "NG" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await sessionRequest(page.request).post("/api/identity/sandbox/complete", {
          headers,
          data: { verificationId: crypto.randomUUID(), outcome: "VERIFIED" },
        })
      ).status(),
    ).toBe(404);
    await page.goto("/identity/sandbox?verificationId=" + crypto.randomUUID());
    // A streamed Next.js notFound response can retain HTTP 200; no sandbox UI is rendered.
    await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /verify|complete/i })).toHaveCount(0);
    // Even a legacy sandbox VERIFIED row cannot become a hosted-beta trust signal.
    const [record] =
      await sql`insert into identity_verifications (user_id, provider, status) values (${id}, 'sandbox', 'VERIFIED') returning id`;
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Identity verified", exact: true })).toHaveCount(
      0,
    );
    await page.goto("/wallet");
    await expect(
      page.getByRole("link", { name: "Identity not required during beta", exact: true }),
    ).toBeVisible();
    await page.goto("/identity");
    await expect(
      page.getByRole("heading", { name: "Not available during community beta" }),
    ).toBeVisible();
    expect(
      (await sql`select status from identity_verifications where id = ${record.id}`)[0].status,
    ).toBe("VERIFIED");
    expect(
      (await (await sessionRequest(page.request).get("/api/identity")).json()).data.status,
    ).toBe("NOT_STARTED");
    const ready = await sessionRequest(page.request).get("/api/health/ready");
    expect(ready.status()).toBe(200);
    expect((await ready.json()).dependencies.identity).toBe("intentionally_disabled_for_beta");
  } finally {
    await sql.end();
  }
});
