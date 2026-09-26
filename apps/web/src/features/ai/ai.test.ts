import { describe, expect, it } from "vitest";
import { jobBuilderInputSchema, proposalAssistantInputSchema } from "./schemas";
import { TemplateMarketplaceAiProvider } from "./server/template-provider";

describe("marketplace AI assistance", () => {
  it("validates workflow-specific requests", () => {
    expect(
      jobBuilderInputSchema.parse({ description: "Build an accessible React dashboard." })
        .description,
    ).toContain("dashboard");
    expect(() => jobBuilderInputSchema.parse({ description: "too short" })).toThrow();
    expect(() => proposalAssistantInputSchema.parse({ listingId: "not-a-uuid" })).toThrow();
  });

  it("references only matching Klaveroq portfolio data in proposal suggestions", async () => {
    const suggestion = await new TemplateMarketplaceAiProvider().buildProposal({
      listing: {
        title: "Build a React dashboard",
        description: "Build a responsive analytics dashboard.",
        skills: ["react", "typescript"],
        budgetMin: 1000n,
        budgetMax: 2000n,
      },
      profile: {
        displayName: "Maya Chen",
        headline: "Frontend engineer",
        primaryRole: "Frontend engineering",
        skills: ["react", "typescript"],
        bio: "Frontend specialist.",
      },
      portfolio: [
        {
          title: "Analytics workspace",
          description: "A dashboard.",
          skills: ["react"],
          projectRole: "Engineer",
        },
        {
          title: "Unrelated campaign",
          description: "A campaign.",
          skills: ["marketing"],
          projectRole: "Writer",
        },
      ],
    });
    expect(suggestion.relevantExperience).toEqual(["Analytics workspace"]);
    expect(suggestion.coverLetter).toContain("Analytics workspace");
    expect(suggestion.coverLetter).not.toContain("Unrelated campaign");
  });
});
