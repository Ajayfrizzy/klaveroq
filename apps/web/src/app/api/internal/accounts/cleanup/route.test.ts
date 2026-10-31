import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ cleanup: vi.fn() }));
vi.mock("@/server/account/gate", () => ({
  gatedRequest: (_request: unknown, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/server/account/cleanup", () => ({ cleanupAccounts: mocks.cleanup }));
vi.mock("@/server/audit", () => ({ audit: vi.fn() }));
import { POST } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "s".repeat(32));
  vi.stubEnv("ACCOUNT_CLEANUP_ENABLED", "");
});
afterEach(() => vi.unstubAllEnvs());
it("requires authorization and explicit activation before cleanup", async () => {
  const url = "http://localhost/api/internal/accounts/cleanup";
  expect((await POST(new Request(url, { method: "POST" }))).status).toBe(401);
  expect(
    (
      await POST(
        new Request(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${"s".repeat(32)}` },
        }),
      )
    ).status,
  ).toBe(503);
  expect(mocks.cleanup).not.toHaveBeenCalled();
});
it("signals a retryable failure rather than hiding a failed batch", async () => {
  vi.stubEnv("ACCOUNT_CLEANUP_ENABLED", "true");
  mocks.cleanup.mockResolvedValue({ processed: 1, deferred: 0, failed: 1 });
  expect(
    (
      await POST(
        new Request("http://localhost/api/internal/accounts/cleanup", {
          method: "POST",
          headers: { Authorization: `Bearer ${"s".repeat(32)}` },
        }),
      )
    ).status,
  ).toBe(503);
});
