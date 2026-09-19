import { describe, expect, it } from "vitest";
import { createDisputeReference, createJobReference, createSupportReference } from "./references";

describe("Klaveroq references", () => {
  it("uses the KQ prefix for job references", () => {
    expect(createJobReference()).toMatch(/^KQ-[A-Z0-9]+\d{3}$/);
  });

  it("uses scoped KQ prefixes for disputes and support cases", () => {
    expect(createDisputeReference()).toMatch(/^KQ-D-\d{6}$/);
    expect(createSupportReference()).toMatch(/^KQ-S-\d{6}$/);
  });
});
