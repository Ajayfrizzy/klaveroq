import { describe, expect, it } from "vitest";
import { confirmedFinancialSummary } from "./metrics";

describe("confirmedFinancialSummary", () => {
  it("returns unavailable values when no authoritative records exist", () => {
    expect(confirmedFinancialSummary([])).toEqual({ secured: null, released: null });
  });

  it("counts only confirmed funding and releases from the current month", () => {
    const now = new Date("2026-09-23T12:00:00Z");
    expect(
      confirmedFinancialSummary(
        [
          { type: "FUND", status: "CONFIRMED", amount: 120n, asset: "CKB", createdAt: now },
          { type: "FUND", status: "PENDING", amount: 900n, asset: "CKB", createdAt: now },
          {
            type: "MILESTONE_RELEASE",
            status: "CONFIRMED",
            amount: 30n,
            asset: "CKB",
            createdAt: now,
          },
          {
            type: "MILESTONE_RELEASE",
            status: "CONFIRMED",
            amount: 50n,
            asset: "CKB",
            createdAt: new Date("2026-08-01T00:00:00Z"),
          },
        ],
        now,
      ),
    ).toEqual({
      secured: { amount: 120n, asset: "CKB", count: 1 },
      released: { amount: 30n, asset: "CKB", count: 1 },
    });
  });
});
