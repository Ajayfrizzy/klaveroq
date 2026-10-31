import { describe, expect, it } from "vitest";
import { policyDocuments } from "./documents";
import { findPolicy, policyRegistry, POLICY_STATUS, POLICY_VERSION } from "./registry";
import { legalMetadata } from "./metadata";

describe("public policy publishing boundaries", () => {
  it("keeps every policy explicitly draft with no effective date or implied acceptance", () => {
    expect(POLICY_STATUS).toBe("Draft — not yet effective");
    expect(POLICY_VERSION).toMatch(/draft$/);
    expect(policyRegistry).toHaveLength(6);
    expect(findPolicy("__proto__")).toBeUndefined();
    expect(findPolicy("../../account/settings")).toBeUndefined();
    for (const policy of policyRegistry) {
      const sections = policyDocuments[policy.slug];
      expect(sections.length).toBeGreaterThanOrEqual(5);
      expect(new Set(sections.map((section) => section.id)).size).toBe(sections.length);
      for (const section of sections) {
        expect(section.id).toMatch(/^[a-z][a-z-]+$/);
        expect(section.paragraphs.length).toBeGreaterThan(0);
        for (const link of section.links ?? []) {
          expect(link.href).toMatch(
            /^\/(legal(?:\/[a-z-]+)?|account\/(settings|recover|privacy)|support)$/,
          );
          if (link.href.startsWith("/legal/")) expect(findPolicy(link.href.slice(7))).toBeDefined();
        }
      }
      const metadata = legalMetadata(policy.title, policy.description, `/legal/${policy.slug}`);
      expect(metadata.title).toContain("Draft");
      expect(metadata.robots).toEqual({ index: false, follow: false });
      expect(metadata.openGraph).toMatchObject({ title: metadata.title });
    }
  });
  it("keeps financial proposals and cleanup availability separate from live promises", () => {
    const paymentText = policyDocuments.payments.flatMap((s) => s.paragraphs).join(" ");
    expect(paymentText).toContain(
      "Real payments, escrow funding, refunds and settlement are not yet operational",
    );
    expect(paymentText).toContain("proposed 3% client fee and 2% worker fee");
    expect(paymentText).toContain("not binding payment terms");
    const deletionText = policyDocuments["account-deletion"].flatMap((s) => s.paragraphs).join(" ");
    expect(deletionText).toContain("Automatic final account cleanup is not activated");
    expect(deletionText).toContain("not a statutory deadline");
    expect(deletionText).toContain("Logging in does not silently cancel");
  });
});
