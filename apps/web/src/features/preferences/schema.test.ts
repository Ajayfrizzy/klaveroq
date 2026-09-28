import { describe, expect, it } from "vitest";
import { importSchema, normalizedQuery, savedSearchSchema } from "./schema";

describe("account search validation", () => {
  it("normalizes order, whitespace and default filters to one internal query", () => {
    const a = savedSearchSchema.parse({
      scope: "talent",
      name: " Design ",
      parameters: { sort: "reputation", query: " design ", minCompletedJobs: "0" },
    });
    const b = savedSearchSchema.parse({
      scope: "talent",
      name: "Other",
      parameters: { query: "design" },
    });
    expect(normalizedQuery(a)).toBe(normalizedQuery(b));
    expect(a.name).toBe("Design");
  });
  it.each([
    { scope: "talent", name: "x", parameters: { redirect: "https://evil.test" } },
    { scope: "talent", name: "x", parameters: { cursor: "other" } },
    { scope: "talent", name: "x", parameters: { minCompletedJobs: "-1" } },
    { scope: "discover", name: "x", parameters: { minBudget: "100", maxBudget: "5" } },
    { scope: "discover", name: "x", parameters: { deadlineBefore: "not-a-date" } },
    { scope: "elsewhere", name: "x", parameters: {} },
    { scope: "talent", name: "x".repeat(61), parameters: {} },
    { scope: "talent", name: "x", parameters: {}, userId: "other" },
  ])("rejects malformed or unowned data: %j", (input) =>
    expect(savedSearchSchema.safeParse(input).success).toBe(false),
  );
  it("rejects malformed imports and more than three shortlist IDs", () => {
    expect(
      importSchema.parse({ talentIds: ["E68B3902-B6E9-492D-8BBA-45C17DF889C4"] }).talentIds,
    ).toEqual(["e68b3902-b6e9-492d-8bba-45c17df889c4"]);
    expect(importSchema.safeParse({ workspaceFocus: "admin" }).success).toBe(false);
    expect(
      importSchema.safeParse({ talentIds: Array(4).fill("e68b3902-b6e9-492d-8bba-45c17df889c4") })
        .success,
    ).toBe(false);
  });
});
