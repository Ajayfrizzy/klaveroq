import { describe, expect, it } from "vitest";
import { confirmedFinancialSummary, formatAssetAmount, presentAssetTotals } from "./metrics";
import { isFirstTimeUser, type OnboardingSignals } from "./onboarding";

const base = {
  jobId: "job-1",
  milestoneId: "milestone-1",
  status: "CONFIRMED",
  asset: "CKB",
  assetDecimals: 8,
  createdAt: new Date("2026-09-23T12:00:00Z"),
};

describe("confirmedFinancialSummary", () => {
  it("reports current secured funds as unavailable without reconciled balances", () => {
    const summary = confirmedFinancialSummary([
      { ...base, id: "fund", type: "FUND", amount: 120n },
      { ...base, id: "release", type: "RELEASE", amount: 30n },
      { ...base, id: "refund", type: "REFUND", amount: 20n },
    ]);
    expect(summary.secured).toBeNull();
    expect(summary.funding).toEqual([{ amount: 120n, asset: "CKB", assetDecimals: 8, count: 1 }]);
  });

  it("groups assets instead of combining unlike values", () => {
    const summary = confirmedFinancialSummary([
      { ...base, id: "ckb", type: "FUND", amount: 100_000_000n },
      { ...base, id: "usdt", type: "FUND", amount: 2_000_000n, asset: "USDT", assetDecimals: 6 },
    ]);
    expect(summary.funding).toHaveLength(2);
    expect(presentAssetTotals(summary.funding, "none")).toEqual({
      value: "Multiple assets",
      note: "1 CKB · 2 USDT",
    });
  });

  it("uses UTC month boundaries and includes historical-job releases", () => {
    const now = new Date("2026-09-15T12:00:00Z");
    const summary = confirmedFinancialSummary(
      [
        {
          ...base,
          id: "start",
          type: "MILESTONE_RELEASE",
          amount: 30n,
          createdAt: new Date("2026-09-01T00:00:00.000Z"),
        },
        {
          ...base,
          id: "before",
          type: "RELEASE",
          amount: 40n,
          createdAt: new Date("2026-08-31T23:59:59.999Z"),
        },
        {
          ...base,
          id: "end",
          type: "RELEASE",
          amount: 50n,
          createdAt: new Date("2026-10-01T00:00:00.000Z"),
        },
      ],
      now,
    );
    expect(summary.released).toEqual([{ amount: 30n, asset: "CKB", assetDecimals: 8, count: 1 }]);
  });

  it("does not merge identical external references from different agreements", () => {
    const summary = confirmedFinancialSummary([
      { ...base, id: "one", externalReference: "tx-1", type: "RELEASE", amount: 25n },
      {
        ...base,
        id: "two",
        jobId: "job-2",
        milestoneId: "milestone-2",
        externalReference: "tx-1",
        type: "MILESTONE_RELEASE",
        amount: 25n,
      },
    ]);
    expect(summary.released).toEqual([{ amount: 50n, asset: "CKB", assetDecimals: 8, count: 2 }]);
  });

  it("does not merge identical references across assets or decimal precisions", () => {
    const summary = confirmedFinancialSummary([
      { ...base, id: "ckb", externalReference: "tx-1", type: "RELEASE", amount: 25n },
      {
        ...base,
        id: "usdt",
        externalReference: "tx-1",
        type: "MILESTONE_RELEASE",
        amount: 25n,
        asset: "USDT",
        assetDecimals: 6,
      },
    ]);
    expect(summary.released).toEqual([
      { amount: 25n, asset: "CKB", assetDecimals: 8, count: 1 },
      { amount: 25n, asset: "USDT", assetDecimals: 6, count: 1 },
    ]);
  });

  it("does not merge identical references across decimal precisions for one asset", () => {
    const summary = confirmedFinancialSummary([
      { ...base, id: "eight", externalReference: "tx-1", type: "RELEASE", amount: 25n },
      {
        ...base,
        id: "six",
        externalReference: "tx-1",
        type: "MILESTONE_RELEASE",
        amount: 25n,
        assetDecimals: 6,
      },
    ]);
    expect(summary.released).toEqual([
      { amount: 25n, asset: "CKB", assetDecimals: 8, count: 1 },
      { amount: 25n, asset: "CKB", assetDecimals: 6, count: 1 },
    ]);
  });

  it("retains distinct milestones within one agreement", () => {
    const summary = confirmedFinancialSummary([
      { ...base, id: "one", externalReference: "tx-1", type: "RELEASE", amount: 25n },
      {
        ...base,
        id: "two",
        milestoneId: "milestone-2",
        externalReference: "tx-1",
        type: "MILESTONE_RELEASE",
        amount: 25n,
      },
    ]);
    expect(summary.released[0]).toMatchObject({ amount: 50n, count: 2 });
  });

  it("deduplicates two representations of one confirmed settlement", () => {
    const summary = confirmedFinancialSummary([
      { ...base, id: "one", externalReference: "tx-1", type: "MILESTONE_RELEASE", amount: 25n },
      { ...base, id: "two", externalReference: "tx-1", type: "RELEASE", amount: 25n },
    ]);
    expect(summary.released).toEqual([{ amount: 25n, asset: "CKB", assetDecimals: 8, count: 1 }]);
  });

  it("retains different settlement references within one agreement", () => {
    const summary = confirmedFinancialSummary([
      { ...base, id: "one", externalReference: "tx-1", type: "RELEASE", amount: 25n },
      { ...base, id: "two", externalReference: "tx-2", type: "RELEASE", amount: 25n },
    ]);
    expect(summary.released[0]).toMatchObject({ amount: 50n, count: 2 });
  });

  it("retains records without a complete external settlement identity", () => {
    const summary = confirmedFinancialSummary([
      { ...base, id: "one", externalReference: null, type: "RELEASE", amount: 25n },
      { ...base, id: "two", externalReference: null, type: "MILESTONE_RELEASE", amount: 25n },
    ]);
    expect(summary.released[0]).toMatchObject({ amount: 50n, count: 2 });
  });

  it("excludes pending and failed operations from confirmed totals", () => {
    const summary = confirmedFinancialSummary([
      { ...base, id: "confirmed", externalReference: "tx-1", type: "RELEASE", amount: 25n },
      { ...base, id: "pending", type: "RELEASE", status: "PENDING", amount: 100n },
      { ...base, id: "failed", type: "FUND", status: "FAILED", amount: 200n },
    ]);
    expect(summary.released).toEqual([{ amount: 25n, asset: "CKB", assetDecimals: 8, count: 1 }]);
    expect(summary.funding).toEqual([]);
  });

  it("produces the same deduplicated total regardless of record order", () => {
    const records = [
      { ...base, id: "one", externalReference: "tx-1", type: "MILESTONE_RELEASE", amount: 25n },
      { ...base, id: "two", externalReference: "tx-1", type: "RELEASE", amount: 25n },
      { ...base, id: "three", externalReference: "tx-2", type: "RELEASE", amount: 10n },
    ];
    expect(confirmedFinancialSummary(records).released).toEqual(
      confirmedFinancialSummary([...records].reverse()).released,
    );
  });

  it("formats integer asset units without losing bigint precision", () => {
    expect(formatAssetAmount(12_345_678_901n, 8)).toBe("123.45678901");
    expect(formatAssetAmount(9_007_199_254_740_993n, 0)).toBe("9,007,199,254,740,993");
  });
});

describe("isFirstTimeUser", () => {
  const newUser: OnboardingSignals = {
    hasAgreement: false,
    hasListing: false,
    hasProposal: false,
    hasPortfolioItem: false,
    profileIsPublic: false,
  };

  it("shows onboarding for a genuinely new account", () => {
    expect(isFirstTimeUser(newUser)).toBe(true);
  });

  it.each([
    "hasAgreement",
    "hasListing",
    "hasProposal",
    "hasPortfolioItem",
    "profileIsPublic",
  ] as const)("does not treat established %s history as first-time", (signal) => {
    expect(isFirstTimeUser({ ...newUser, [signal]: true })).toBe(false);
  });
});
