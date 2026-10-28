import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ token: "test-token", query: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (mocks.token ? { value: mocks.token } : undefined) }),
}));
vi.mock("../observability/render-context", () => ({
  getRenderRequestId: async () => "f4041e0e-0532-4aa2-9a5c-1c89a5a048c0",
}));
vi.mock("../db", () => ({
  db: {
    select: () => {
      const query = {
        from: () => query,
        innerJoin: () => query,
        leftJoin: () => query,
        where: () => query,
        limit: mocks.query,
      };
      return query;
    },
  },
}));
import { getCurrentUser } from "./session";
beforeEach(() => {
  mocks.token = "test-token";
  mocks.query.mockReset();
  vi.stubEnv("ERROR_MONITORING_WEBHOOK_URL", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it("keeps a missing or expired session distinct from an authentication database failure", async () => {
  mocks.token = "";
  expect(await getCurrentUser()).toBeNull();
  expect(mocks.query).not.toHaveBeenCalled();
  mocks.token = "test-token";
  mocks.query.mockResolvedValueOnce([]);
  expect(await getCurrentUser()).toBeNull();
  mocks.query.mockRejectedValueOnce(
    Object.assign(new Error("database timeout with private data"), { code: "57014" }),
  );
  await expect(getCurrentUser()).rejects.toMatchObject({
    code: "57014",
    message: "Account information could not be loaded.",
  });
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain("auth.session");
});
it("recovers a valid session after a temporary failure instead of caching a signed-out state", async () => {
  mocks.query.mockRejectedValueOnce(
    Object.assign(new Error("connection down"), { code: "ECONNRESET" }),
  );
  await expect(getCurrentUser()).rejects.toThrow();
  const current = { user: { id: "user", status: "ACTIVE" }, profile: null, sessionId: "session" };
  mocks.query.mockResolvedValueOnce([current]);
  expect(await getCurrentUser()).toEqual(current);
});
