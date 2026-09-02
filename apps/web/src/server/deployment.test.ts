import { describe, expect, it } from "vitest";
import { usesPreviewData } from "./deployment";

describe("deployment mode", () => {
  it("uses preview data on Vercel when no database is configured", () => {
    expect(usesPreviewData({ VERCEL: "1" })).toBe(true);
  });

  it("uses the database when Vercel has a database URL", () => {
    expect(usesPreviewData({ VERCEL: "1", DATABASE_URL: "postgresql://database" })).toBe(false);
  });

  it("supports an explicit preview override for local verification", () => {
    expect(usesPreviewData({ VEYRIVO_PREVIEW_MODE: "1" })).toBe(true);
    expect(usesPreviewData({ VERCEL: "1", VEYRIVO_PREVIEW_MODE: "0" })).toBe(false);
  });
});
