import { expect, test } from "@playwright/test";
import postgres from "postgres";

const password = "KlaveroqTest123";
const replacementPassword = "KlaveroqChanged456";
const origin = "http://127.0.0.1:3199";
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://klaveroq_test:klaveroq_test@127.0.0.1:55434/klaveroq_test";

test("email verification and password recovery are complete single-use workflows", async ({
  page,
}) => {
  const email = `auth-${Date.now()}@example.test`;

  await page.goto("/register");
  await page.getByLabel("Display name").fill("Authentication Test");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  const registrationResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/register") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create account" }).click();
  const registration = await registrationResponse;
  expect(registration.status()).toBe(201);
  const verificationToken = (await registration.json()).data.verificationToken as string;
  await expect(page).toHaveURL(/\/verify-email\?/);
  await page.getByRole("link", { name: "Open local verification link" }).click();
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();

  const replay = await page.request.post("/api/auth/verify-email", {
    headers: { Origin: origin },
    data: { token: verificationToken },
  });
  expect(replay.status()).toBe(400);

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/If that address has an account/)).toBeVisible();
  await page.getByRole("link", { name: "Open local reset link" }).click();
  await page.getByLabel("New password", { exact: true }).fill(replacementPassword);
  await page.getByLabel("Confirm new password").fill(replacementPassword);
  const resetResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/password/reset") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Update password" }).click();
  expect((await resetResponse).status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();

  const session = await page.request.get("/api/auth/me");
  expect((await session.json()).data).toBeNull();

  await page.getByRole("link", { name: "Sign in" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(replacementPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await page.request.post("/api/auth/password/request", {
      headers: { Origin: origin },
      data: { email },
    });
    expect(response.status()).toBe(attempt < 2 ? 200 : 429);
  }

  const duplicate = await page.request.post("/api/auth/register", {
    headers: { Origin: origin },
    data: { email, displayName: "Duplicate Account", password },
  });
  expect(duplicate.status()).toBe(409);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const invalidLogin = await page.request.post("/api/auth/login", {
      headers: { Origin: origin },
      data: { email, password: "IncorrectPassword123" },
    });
    expect(invalidLogin.status()).toBe(401);
  }
  const lockedLogin = await page.request.post("/api/auth/login", {
    headers: { Origin: origin },
    data: { email, password: replacementPassword },
  });
  expect(lockedLogin.status()).toBe(423);

  const expiringEmail = `expiring-${Date.now()}@example.test`;
  const expiringRegistration = await page.request.post("/api/auth/register", {
    headers: { Origin: origin },
    data: { email: expiringEmail, displayName: "Expiring Link", password },
  });
  expect(expiringRegistration.status()).toBe(201);
  const expiringBody = await expiringRegistration.json();
  const originalToken = expiringBody.data.verificationToken as string;
  const expiringUserId = expiringBody.data.user.id as string;
  const resend = await page.request.post("/api/auth/verify-email/resend", {
    headers: { Origin: origin },
    data: { email: expiringEmail },
  });
  expect(resend.status()).toBe(200);
  const replacementToken = (await resend.json()).data.verificationToken as string;
  expect(replacementToken).not.toBe(originalToken);
  const invalidated = await page.request.post("/api/auth/verify-email", {
    headers: { Origin: origin },
    data: { token: originalToken },
  });
  expect(invalidated.status()).toBe(400);

  const sql = postgres(testDatabaseUrl, { max: 1 });
  await sql`update verification_tokens set expires_at = now() - interval '1 minute' where user_id = ${expiringUserId} and consumed_at is null`;
  await sql.end();
  const expired = await page.request.post("/api/auth/verify-email", {
    headers: { Origin: origin },
    data: { token: replacementToken },
  });
  expect(expired.status()).toBe(400);
});
