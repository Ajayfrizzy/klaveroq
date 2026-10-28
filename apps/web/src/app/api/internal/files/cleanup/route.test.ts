import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ cleanup: vi.fn(), storage: vi.fn() }));
vi.mock("@/server/audit", () => ({ audit: vi.fn() }));
vi.mock("@/server/files/backend", () => ({ getFileStorage: mocks.storage }));
vi.mock("@/server/files/cleanup", () => ({ cleanupFilePage: mocks.cleanup }));
vi.mock("@/server/files/references", () => ({ isFileReferenced: vi.fn() }));
import { POST } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "s".repeat(32));
  mocks.cleanup.mockResolvedValue({ deleted: 0, candidates: 1 });
});
afterEach(() => vi.unstubAllEnvs());
it("rejects unauthorized cleanup before accessing storage", async () => {
  const response = await POST(
    new Request("https://beta.example/api/internal/files/cleanup", { method: "POST", body: "{}" }),
  );
  expect(response.status).toBe(401);
  expect(mocks.storage).not.toHaveBeenCalled();
});
it("defaults authorized cleanup to dry run and passes the continuation cursor", async () => {
  const response = await POST(
    new Request("https://beta.example/api/internal/files/cleanup", {
      method: "POST",
      headers: { authorization: `Bearer ${"s".repeat(32)}` },
      body: JSON.stringify({ prefix: "clean/", cursor: "next" }),
    }),
  );
  expect(response.status).toBe(200);
  expect(mocks.cleanup).toHaveBeenCalledWith(
    expect.objectContaining({ prefix: "clean/", cursor: "next", dryRun: true }),
  );
});
