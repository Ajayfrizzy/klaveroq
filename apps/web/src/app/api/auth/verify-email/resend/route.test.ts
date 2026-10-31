import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  current: vi.fn(),
  send: vi.fn(),
  limit: vi.fn(),
  origin: vi.fn(),
  issue: vi.fn(),
}));
vi.mock("@/server/db", () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: mocks.query }) }) }) },
}));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: mocks.current }));
vi.mock("@/server/email", () => ({ sendVerificationEmail: mocks.send }));
vi.mock("@/server/auth/tokens", () => ({ issueAuthToken: mocks.issue }));
vi.mock("@/server/auth/rate-limit", () => ({ enforceAuthRateLimit: mocks.limit }));
vi.mock("@/server/http/security", () => ({ assertSameOrigin: mocks.origin }));
vi.mock("@/server/audit", () => ({ audit: vi.fn() }));
vi.mock("@/server/auth/local-mode", () => ({ allowsLocalAuthDelivery: () => false }));
import { POST } from "./route";
const email = "owner@example.test";
const returnTo = "/client-invites/test-token";
const request = () =>
  new Request("http://localhost/api/auth/verify-email/resend", {
    method: "POST",
    body: JSON.stringify({ email, returnTo }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  mocks.query.mockResolvedValue([{ id: "owner", email }]);
  mocks.current.mockResolvedValue({ user: { id: "owner" } });
  mocks.issue.mockResolvedValue("secret-token");
});
afterEach(() => vi.restoreAllMocks());
it.each(["ACCEPTED", "DELIVERED", "FAILED", "SIMULATED", "QUEUED"])(
  "reports %s truthfully to the owner",
  async (status) => {
    mocks.send.mockResolvedValue({ status });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      accepted: true,
      emailSent: ["ACCEPTED", "DELIVERED"].includes(status),
    });
    expect(mocks.send).toHaveBeenCalledWith(email, "secret-token", returnTo);
    expect(mocks.limit).toHaveBeenCalled();
    expect(mocks.origin).toHaveBeenCalled();
  },
);
it("reports a provider exception then allows a successful retry", async () => {
  mocks.send
    .mockRejectedValueOnce(new Error("private provider detail"))
    .mockResolvedValueOnce({ status: "ACCEPTED" });
  expect((await (await POST(request())).json()).data.emailSent).toBe(false);
  expect((await (await POST(request())).json()).data.emailSent).toBe(true);
});
it.each([null, { user: { id: "someone-else" } }])(
  "does not disclose delivery or account existence to %j",
  async (current) => {
    mocks.current.mockResolvedValue(current);
    mocks.send.mockResolvedValue({ status: "ACCEPTED" });
    const existing = await (await POST(request())).json();
    mocks.send.mockRejectedValue(new Error("delivery failed"));
    expect(await (await POST(request())).json()).toEqual(existing);
    mocks.query.mockResolvedValue([]);
    expect(await (await POST(request())).json()).toEqual(existing);
    expect(existing.data).toEqual({ accepted: true });
  },
);
