import { describe, expect, it } from "vitest";
import { usesPreviewData } from "./deployment";

describe("deployment mode", () => {
  it("never enables preview data automatically in a hosted environment", () => {
    expect(usesPreviewData({ VERCEL: "1" })).toBe(false);
  });

  it("rejects the preview override in production and CI", () => {
    expect(usesPreviewData({ NODE_ENV: "production", KLAVEROQ_PREVIEW_MODE: "1" })).toBe(false);
    expect(usesPreviewData({ CI: "1", KLAVEROQ_PREVIEW_MODE: "1" })).toBe(false);
  });

  it("supports only an explicit local preview override", () => {
    expect(usesPreviewData({ KLAVEROQ_PREVIEW_MODE: "1" })).toBe(true);
    expect(usesPreviewData({ KLAVEROQ_PREVIEW_MODE: "0" })).toBe(false);
  });
});
