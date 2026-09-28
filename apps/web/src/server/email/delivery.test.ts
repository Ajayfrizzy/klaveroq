import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalEmailProvider, ResendEmailProvider } from "./provider";
import { emailAppUrl, emailDestination, emailTemplate } from "./templates";
import { verifyResendWebhook } from "./webhook";
import { productionConfigurationIssues } from "../deployment";
import { sendEmail } from ".";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const message = { to: "test@example.test", subject: "Test", text: "Text", html: "<p>Text</p>" };
describe("transactional delivery boundary", () => {
  it("rejects missing production configuration without falling back to simulation", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://beta.example.test");
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(sendEmail(message, "invalid-config")).rejects.toThrow("not configured");
    vi.stubEnv("EMAIL_PROVIDER", "local");
    vi.stubEnv("AUTH_EXPOSE_LOCAL_TOKENS", "0");
    await expect(sendEmail(message, "invalid-config")).rejects.toThrow("not configured");
  });
  it("labels local delivery as simulated", async () => {
    expect(await new LocalEmailProvider().send()).toEqual({ status: "SIMULATED" });
  });
  it("records provider acceptance, not delivery, with a stable idempotency key", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "receipt-1" }));
    vi.stubGlobal("fetch", fetcher);
    expect(
      await new ResendEmailProvider("key", "accounts@example.test").send(message, "stable-key"),
    ).toEqual({ status: "ACCEPTED", providerId: "receipt-1" });
    expect(fetcher.mock.calls[0][1].headers["Idempotency-Key"]).toBe("stable-key");
    expect(fetcher.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it.each([
    [422, true],
    [401, true],
    [429, false],
    [503, false],
  ])("classifies HTTP %s safely", async (status, permanent) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { message: "private provider detail" },
            { status, headers: { "retry-after": "30" } },
          ),
        ),
    );
    await expect(
      new ResendEmailProvider("key", "a@example.test").send(message, "key"),
    ).rejects.toMatchObject({ code: `RESEND_HTTP_${status}`, permanent, retryAfterMs: 30000 });
  });
  it("does not accept malformed success receipts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));
    await expect(
      new ResendEmailProvider("key", "a@example.test").send(message, "key"),
    ).rejects.toMatchObject({ code: "RESEND_INVALID_RECEIPT" });
  });
  it("escapes user text and confines links to the configured origin", () => {
    vi.stubEnv("APP_URL", "https://beta.example.test");
    const template = emailTemplate('<img src=x onerror="bad">', "A & B", "/jobs?x=1&y=2");
    expect(template.html).toContain("&lt;img");
    expect(template.html).toContain("A &amp; B");
    expect(template.text).toContain("https://beta.example.test/jobs?x=1&y=2");
    expect(() => emailDestination("//evil.example/x")).toThrow();
    expect(() => emailDestination("javascript:alert(1)")).toThrow();
    expect(() => emailAppUrl({ APP_URL: "http://hosted.example" })).toThrow();
    expect(() => emailAppUrl({ APP_URL: "https://user:password@example.test" })).toThrow();
  });
  it("fails readiness for missing sender, webhook and invalid origin", () => {
    expect(
      productionConfigurationIssues({
        NODE_ENV: "production",
        APP_URL: "https://bad:password@example.test",
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "key",
      }),
    ).toEqual(expect.arrayContaining(["email_sender", "email_webhook", "email_app_url"]));
  });
  it("authenticates raw webhook bytes and rejects tampering and stale signatures", () => {
    const secret = `whsec_${Buffer.alloc(32, 7).toString("base64")}`;
    const now = Date.now(),
      stamp = String(Math.floor(now / 1000)),
      raw = '{"type":"email.delivered"}';
    const signature = createHmac("sha256", Buffer.alloc(32, 7))
      .update(`event-1.${stamp}.${raw}`)
      .digest("base64");
    const headers = new Headers({
      "svix-id": "event-1",
      "svix-timestamp": stamp,
      "svix-signature": `v1,${signature}`,
    });
    expect(verifyResendWebhook(raw, headers, secret, now)).toBe(true);
    expect(verifyResendWebhook(raw + " ", headers, secret, now)).toBe(false);
    expect(verifyResendWebhook(raw, headers, secret, now + 600_000)).toBe(false);
    expect(verifyResendWebhook(raw, headers, "whsec_bad", now)).toBe(false);
  });
});
