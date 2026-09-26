import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { ClientPublicTestnet, SignerCkbPrivateKey } from "@ckb-ccc/core";
import postgres from "postgres";
import { totpCode } from "../../src/server/auth/mfa";

const password = "KlaveroqTest123";
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://klaveroq_test:klaveroq_test@127.0.0.1:55434/klaveroq_test";

test("identity, wallet ownership, and session security workflows enforce their boundaries", async ({
  page,
}) => {
  const email = `security-${Date.now()}@example.test`;
  await page.goto("/register");
  await page.getByLabel("Display name").fill("Security Test");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email/);

  await page.goto("/identity");
  await expect(page.getByRole("heading", { name: "Identity check not started" })).toBeVisible();
  await page.getByLabel("Country code").fill("NG");
  await page.getByRole("button", { name: "Start identity check" }).click();
  await expect(page.getByRole("heading", { name: "Identity provider sandbox" })).toBeVisible();
  await page.getByRole("button", { name: "Return verified" }).click();
  await expect(page).toHaveURL(/\/identity$/);
  await expect(page.getByRole("heading", { name: "Identity verified" })).toBeVisible();

  const signer = new SignerCkbPrivateKey(
    new ClientPublicTestnet(),
    "0x5c3e84ef4c4e84f729f35a64f532514cf61f33f140621e54f58a2d89b817d001",
  );
  const address = await signer.getRecommendedAddress();
  await page.goto("/wallet");
  await page.getByLabel("Network").selectOption("testnet");
  await page.getByLabel("Wallet address").fill(address);
  const challengeResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/wallets/challenge") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create signing message" }).click();
  const challenge = (await (await challengeResponse).json()).data;
  const signed = await signer.signMessage(challenge.message);
  await page.getByLabel("Signature").fill(signed.signature);
  await page.getByLabel("Public key").fill(signer.publicKey);
  const verificationResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/wallets/verify") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Verify ownership" }).click();
  expect((await verificationResponse).status()).toBe(200);
  await expect(page.getByText("Wallet ownership verified.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "TESTNET wallet" })).toBeVisible();

  const replayStatus = await page.evaluate(
    async (data) => {
      const response = await fetch("/api/wallets/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.status;
    },
    {
      challengeId: challenge.id,
      nonce: challenge.nonce,
      signature: signed.signature,
      publicKey: signer.publicKey,
      purpose: "BOTH",
    },
  );
  expect(replayStatus).toBe(400);

  const otherSigner = new SignerCkbPrivateKey(
    new ClientPublicTestnet(),
    "0x7c3e84ef4c4e84f729f35a64f532514cf61f33f140621e54f58a2d89b817d002",
  );
  const wrongAccountChallenge = await page.evaluate(
    async ({ address }) => {
      const response = await fetch("/api/wallets/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, network: "testnet" }),
      });
      return (await response.json()).data;
    },
    { address },
  );
  const wrongAccountSignature = await otherSigner.signMessage(wrongAccountChallenge.message);
  const wrongAccountStatus = await page.evaluate(
    async (data) => {
      const response = await fetch("/api/wallets/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.status;
    },
    {
      challengeId: wrongAccountChallenge.id,
      nonce: wrongAccountChallenge.nonce,
      signature: wrongAccountSignature.signature,
      publicKey: otherSigner.publicKey,
      purpose: "BOTH",
    },
  );
  expect(wrongAccountStatus).toBe(400);

  const wrongNetworkChallenge = await page.evaluate(
    async ({ address }) => {
      const response = await fetch("/api/wallets/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, network: "mainnet" }),
      });
      return (await response.json()).data;
    },
    { address },
  );
  const wrongNetworkSignature = await signer.signMessage(wrongNetworkChallenge.message);
  const wrongNetworkStatus = await page.evaluate(
    async (data) => {
      const response = await fetch("/api/wallets/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.status;
    },
    {
      challengeId: wrongNetworkChallenge.id,
      nonce: wrongNetworkChallenge.nonce,
      signature: wrongNetworkSignature.signature,
      publicKey: signer.publicKey,
      purpose: "BOTH",
    },
  );
  expect(wrongNetworkStatus).toBe(400);

  const invalidOrigin = await page.request.post("/api/wallets/challenge", {
    headers: { Origin: "https://invalid.example" },
    data: { address, network: "testnet" },
  });
  expect(invalidOrigin.status()).toBe(403);

  const sql = postgres(testDatabaseUrl, { max: 1 });
  const expiredChallenge = await page.evaluate(
    async ({ address }) => {
      const response = await fetch("/api/wallets/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, network: "testnet" }),
      });
      return (await response.json()).data;
    },
    { address },
  );
  await sql`update wallet_challenges set expires_at = now() - interval '1 minute' where id = ${expiredChallenge.id}`;
  const expiredStatus = await page.evaluate(
    async (data) => {
      const response = await fetch("/api/wallets/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.status;
    },
    {
      challengeId: expiredChallenge.id,
      nonce: expiredChallenge.nonce,
      signature: signed.signature,
      publicKey: signer.publicKey,
      purpose: "BOTH",
    },
  );
  expect(expiredStatus).toBe(400);
  const [user] = await sql<{ id: string }[]>`select id from users where email = ${email}`;
  const remoteToken = randomBytes(32).toString("base64url");
  const remoteTokenHash = createHash("sha256").update(remoteToken).digest("hex");
  await sql`insert into sessions (user_id, token_hash, user_agent, expires_at)
            values (${user.id}, ${remoteTokenHash}, 'Remote browser for test', now() + interval '1 day')`;
  await sql.end();

  const sessionRecords = await page.evaluate(async () => {
    const response = await fetch("/api/auth/sessions");
    if (!response.ok) throw new Error(`Sessions returned ${response.status}`);
    return (await response.json()).data as Array<{ id: string; current: boolean }>;
  });
  const currentSession = sessionRecords.find((session) => session.current);
  const remoteSession = sessionRecords.find((session) => !session.current);
  expect(currentSession).toBeTruthy();
  expect(remoteSession).toBeTruthy();
  const currentRevokeStatus = await page.evaluate(async (id) => {
    const response = await fetch(`/api/auth/sessions/${id}`, { method: "DELETE" });
    return response.status;
  }, currentSession!.id);
  expect(currentRevokeStatus).toBe(400);
  const remoteRevokeStatus = await page.evaluate(async (id) => {
    const response = await fetch(`/api/auth/sessions/${id}`, { method: "DELETE" });
    return response.status;
  }, remoteSession!.id);
  expect(remoteRevokeStatus).toBe(204);
  await page.reload();
  await expect(page.getByText("Remote browser for test")).toHaveCount(0);
  await expect(page.getByText("Current session")).toBeVisible();

  await page.getByRole("button", { name: "Remove wallet" }).click();
  await expect(page.getByRole("heading", { name: "TESTNET wallet" })).toBeVisible();
  await expect(page.getByText("revoked", { exact: true })).toBeVisible();

  await page.getByLabel("Current password").fill(password);
  await page.getByRole("button", { name: "Set up MFA" }).click();
  const setupKey = await page.locator(".mfa-secret code").innerText();
  const recoveryCodes = await page.locator('[aria-label="Recovery codes"] code').allInnerTexts();
  expect(recoveryCodes).toHaveLength(8);
  await page.getByLabel("Six-digit authenticator code").fill(totpCode(setupKey));
  await page.getByRole("button", { name: "Confirm and enable" }).click();
  await expect(page.getByText("Enabled · 8 recovery codes available.")).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Two-factor authentication" })).toBeVisible();
  await page.getByLabel("Authentication code").fill("000000");
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page.getByText("The authenticator or recovery code is invalid.")).toBeVisible();
  await page.getByLabel("Authentication code").fill(totpCode(setupKey));
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page).toHaveURL("/");

  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Authentication code").fill(recoveryCodes[0]);
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/wallet");
  await expect(page.getByText("Enabled · 7 recovery codes available.")).toBeVisible();
  await page.getByLabel("Authenticator or recovery code").fill(recoveryCodes[1]);
  await page.getByRole("button", { name: "Disable MFA" }).click();
  await expect(page.getByRole("button", { name: "Set up MFA" })).toBeVisible();
});
