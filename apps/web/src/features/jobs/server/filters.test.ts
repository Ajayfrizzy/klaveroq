import { describe, expect, it } from "vitest";
import { agreementStatusLabel, jobWorkspaceQuerySchema } from "./filters";

describe("job workspace filters", () => {
  it("normalizes blank filters and defaults to agreements", () => {
    expect(jobWorkspaceQuerySchema.parse({ query: "", status: "" })).toEqual({
      view: "agreements",
      query: undefined,
      status: undefined,
    });
  });

  it("trims a search and accepts a real agreement status", () => {
    expect(
      jobWorkspaceQuerySchema.parse({
        view: "agreements",
        query: "  Maya  ",
        status: "IN_PROGRESS",
      }),
    ).toEqual({ view: "agreements", query: "Maya", status: "IN_PROGRESS" });
  });

  it("supports the same bounded search across listing and proposal views", () => {
    expect(jobWorkspaceQuerySchema.parse({ view: "listings", query: "  TypeScript  " })).toEqual({
      view: "listings",
      query: "TypeScript",
      status: undefined,
    });
    expect(jobWorkspaceQuerySchema.parse({ view: "proposals", query: "Client" }).view).toBe(
      "proposals",
    );
    expect(() => jobWorkspaceQuerySchema.parse({ query: "x".repeat(101) })).toThrow();
  });

  it("rejects unsupported views and statuses", () => {
    expect(() => jobWorkspaceQuerySchema.parse({ view: "unknown" })).toThrow();
    expect(() => jobWorkspaceQuerySchema.parse({ status: "OPEN" })).toThrow();
  });

  it("presents status values as readable labels", () => {
    expect(agreementStatusLabel("AWAITING_FUNDING")).toBe("awaiting funding");
  });
});
