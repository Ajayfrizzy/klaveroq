import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  failTable: "",
  code: "57014",
  tables: [] as string[],
  financial: vi.fn(),
}));
vi.mock("@/server/observability/render-context", () => ({
  getRenderRequestId: async () => "f4041e0e-0532-4aa2-9a5c-1c89a5a048c0",
}));
vi.mock("@/features/payments/server/queries", () => ({ getUserFinancialSummary: mocks.financial }));
vi.mock("@/server/db", async () => {
  const { getTableName } = await import("drizzle-orm");
  return {
    db: {
      select: () => {
        let table = "";
        const query = {
          from(value: Parameters<typeof getTableName>[0]) {
            table = getTableName(value);
            mocks.tables.push(table);
            return query;
          },
          where: () => query,
          orderBy: () => query,
          limit: () => query,
          innerJoin: () => query,
          then(resolve: (rows: unknown[]) => unknown, reject: (error: unknown) => unknown) {
            const result =
              table === mocks.failTable
                ? Promise.reject(
                    new Error("Drizzle query failed", {
                      cause: Object.assign(new Error("timeout"), { code: mocks.code }),
                    }),
                  )
                : Promise.resolve([]);
            return result.then(resolve, reject);
          },
        };
        return query;
      },
    },
  };
});
import { getDashboardData } from "./queries";
beforeEach(() => {
  mocks.failTable = "";
  mocks.code = "57014";
  mocks.tables.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("ERROR_MONITORING_WEBHOOK_URL", "");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it("keeps core data while recent activity is unavailable and recovers without caching the failure", async () => {
  mocks.failTable = "audit_logs";
  expect(await getDashboardData("user", true)).toMatchObject({
    jobs: [],
    activeJobCount: 0,
    activity: null,
  });
  mocks.failTable = "";
  expect((await getDashboardData("user", true)).activity).toEqual([]);
});
it("represents unknown verification as null rather than pending or verified", async () => {
  mocks.failTable = "wallets";
  expect((await getDashboardData("user", true)).verification).toMatchObject({
    email: true,
    wallet: null,
  });
});
it("propagates critical job failures and nontransient optional database failures", async () => {
  mocks.failTable = "jobs";
  await expect(getDashboardData("user", true)).rejects.toMatchObject({ code: "57014" });
  mocks.failTable = "audit_logs";
  mocks.code = "42501";
  await expect(getDashboardData("user", true)).rejects.toMatchObject({ code: "42501" });
});
it("does not query unused financial or recommendation histories on the dashboard", async () => {
  const data = await getDashboardData("user", true);
  expect(mocks.financial).not.toHaveBeenCalled();
  expect(mocks.tables).not.toContain("operations");
  expect(mocks.tables).not.toContain("proposals");
  expect(mocks.tables).not.toContain("portfolio_items");
  expect(data).not.toHaveProperty("financials");
  expect(data).not.toHaveProperty("isFirstTimeUser");
});
