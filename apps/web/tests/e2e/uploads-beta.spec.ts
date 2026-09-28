import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { sessionRequest } from "./preference-test-session";

const origin = "http://127.0.0.1:3201";
test("disabled-upload beta preserves records and supports text profiles, portfolios and support", async ({
  page,
}) => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (
    !databaseUrl ||
    !new URL(databaseUrl).pathname.endsWith("_test") ||
    !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)
  )
    throw new Error("Isolated test database required");
  const sql = postgres(databaseUrl, { max: 1 });
  const api = sessionRequest(page.request);
  const headers = { Origin: origin };
  try {
    await sql`delete from auth_rate_limits where action = 'register'`;
    const registered = await api.post("/api/auth/register", {
      headers,
      data: {
        email: `uploads-beta-${crypto.randomUUID()}@example.test`,
        password: "KlaveroqTest123",
        displayName: "Text Beta Tester",
      },
    });
    expect(registered.status()).toBe(201);
    const id = (await registered.json()).data.user.id;
    await sql`update users set email_verified_at = now(), status = 'ACTIVE' where id = ${id}`;
    // A pre-existing local file record must survive disabling uploads, including its hash/key/status.
    const [legacy] = await sql`insert into media_files
      (owner_user_id, kind, storage_key, original_name, content_type, size_bytes, sha256, scan_status, alt_text)
      values (${id}, 'AVATAR', ${`clean/2026-01-01/${crypto.randomUUID()}.png`}, 'legacy.png', 'image/png', 8, ${"a".repeat(64)}, 'CLEAN', 'Existing photo') returning *`;
    await sql`update profiles set avatar_key = ${legacy.storage_key} where user_id = ${id}`;
    for (const path of [
      "/api/profile/avatar",
      `/api/profile/portfolio/${crypto.randomUUID()}/media`,
      `/api/proofs/${crypto.randomUUID()}/files`,
      `/api/disputes/${crypto.randomUUID()}/evidence`,
      `/api/support/tickets/${crypto.randomUUID()}/attachments`,
    ]) {
      const response = await api.post(path, {
        headers,
        multipart: {
          file: { name: "test.txt", mimeType: "text/plain", buffer: Buffer.from("test upload") },
          note: "Evidence note text",
        },
      });
      expect(response.status(), path).toBe(503);
      expect((await response.json()).error.code).toBe("FILE_UPLOADS_DISABLED");
    }
    expect(await sql`select * from media_files where id = ${legacy.id}`).toEqual([legacy]);
    expect((await sql`select avatar_key from profiles where user_id = ${id}`)[0].avatar_key).toBe(
      legacy.storage_key,
    );

    const saved = await api.patch("/api/profile", {
      headers,
      data: {
        displayName: "Text Beta Tester",
        headline: "Reliable beta engineering",
        primaryRole: "Engineer",
        bio: "I create reliable interfaces and help community members test software workflows.",
        skills: ["typescript"],
        experienceLevel: "EXPERT",
        countryCode: "NG",
        timezone: "Africa/Lagos",
      },
    });
    expect(saved.status()).toBe(200);
    expect(
      (await api.patch("/api/profile/visibility", { headers, data: { isPublic: true } })).status(),
    ).toBe(200);
    const createdPortfolio = await api.post("/api/profile/portfolio", {
      headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
      data: {
        title: "Text-only project",
        description: "A portfolio entry with text and links but no uploaded media.",
        projectUrl: "https://example.test/project",
        githubUrl: null,
        skills: ["typescript"],
        projectRole: "Engineer",
      },
    });
    expect(createdPortfolio.status()).toBe(201);
    const portfolio = (await createdPortfolio.json()).data;
    expect(
      (
        await api.patch(`/api/profile/portfolio/${portfolio.id}`, {
          headers,
          data: {
            title: "Updated text project",
            description: "An updated text-only portfolio remains available during beta.",
            projectUrl: "https://example.test/project",
            githubUrl: null,
            skills: ["typescript"],
            projectRole: "Engineer",
          },
        })
      ).status(),
    ).toBe(200);
    await page.goto("/profile");
    await expect(
      page.getByText("Uploads will become available later.", { exact: false }).first(),
    ).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit profile", exact: true })).toBeEnabled();
    await expect(page.getByText("Updated text project", { exact: true }).first()).toBeVisible();

    const ticketResponse = await api.post("/api/support/tickets", {
      headers,
      data: {
        subject: "Text-only beta support",
        category: "GENERAL",
        message: "Please help me check the text-only beta workflow.",
      },
    });
    expect(ticketResponse.status()).toBe(201);
    const ticketId = (await ticketResponse.json()).data.id;
    await page.goto(`/support/${ticketId}`);
    await expect(page.locator('input[type="file"]')).toBeDisabled();
    await expect(
      page.getByText("Uploads will become available later.", { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "Reply", exact: true })
      .fill("Text replies still work without an attachment.");
    await page.getByRole("button", { name: "Send reply", exact: true }).click();
    await expect(
      page.getByText("Text replies still work without an attachment.", { exact: true }),
    ).toBeVisible();
    expect(await sql`select * from media_files where id = ${legacy.id}`).toEqual([legacy]);
    const ready = await api.get("/api/health/ready");
    expect(ready.status()).toBe(200);
    expect((await ready.json()).dependencies).toMatchObject({
      fileUploads: "disabled",
      fileScanner: "not_required_uploads_disabled",
      fileStorage: "not_required_uploads_disabled",
    });
  } finally {
    await sql.end();
  }
});
