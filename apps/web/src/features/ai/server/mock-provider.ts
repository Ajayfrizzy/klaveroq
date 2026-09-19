import type { MarketplaceAiProvider } from "./provider";
import type { JobBuilderSuggestion, ProposalAssistantContext } from "../types";

const firstSentence = (value: string) =>
  value
    .trim()
    .split(/[.!?]\s/)[0]
    .slice(0, 220);
const titleFrom = (value: string) => {
  const words = value
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 8)
    .join(" ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`.slice(0, 90);
};
const inferCategory = (value: string): JobBuilderSuggestion["category"] => {
  const text = value.toLowerCase();
  if (/design|figma|ux|ui|brand/.test(text)) return "DESIGN";
  if (/write|content|copy|article/.test(text)) return "WRITING";
  if (/market|campaign|seo|growth/.test(text)) return "MARKETING";
  if (/data|analysis|dashboard|research/.test(text)) return "DATA";
  if (/develop|code|api|website|app|react/.test(text)) return "DEVELOPMENT";
  return "OTHER";
};
const inferSkills = (value: string) => {
  const known = [
    "react",
    "typescript",
    "javascript",
    "figma",
    "product design",
    "ux research",
    "copywriting",
    "data analysis",
    "seo",
    "node.js",
  ];
  const text = value.toLowerCase();
  const found = known.filter((skill) => text.includes(skill));
  return found.length ? found.slice(0, 6) : ["project delivery", "documentation"];
};

export class MockMarketplaceAiProvider implements MarketplaceAiProvider {
  async buildJob(description: string) {
    const outcome = firstSentence(description);
    return {
      title: titleFrom(description),
      scope: `${description.trim()} The selected professional should document assumptions, identify exclusions, and deliver reviewable outcomes for each milestone.`,
      category: inferCategory(description),
      skills: inferSkills(description),
      milestones: [
        {
          title: "Scope confirmation",
          deliverable: `A documented delivery plan for: ${outcome}`,
          acceptanceCriteria:
            "The plan covers the agreed scope, dependencies, exclusions, and delivery sequence.",
          evidenceRequirements: "Shareable plan link or document with revision history.",
          deliveryDays: 3,
        },
        {
          title: "Working delivery",
          deliverable: `A review-ready implementation of the agreed ${outcome.toLowerCase()}.`,
          acceptanceCriteria:
            "All agreed requirements are demonstrably complete and available for client review.",
          evidenceRequirements:
            "Working URL or deliverable link plus a concise completion walkthrough.",
          deliveryDays: 10,
        },
        {
          title: "Final verification and handoff",
          deliverable: "Resolved review feedback and complete handoff materials.",
          acceptanceCriteria:
            "Accepted feedback is resolved and the final deliverables are accessible to the client.",
          evidenceRequirements: "Final links, change summary, and verification checklist.",
          deliveryDays: 14,
        },
      ],
      estimatedStructure:
        "Three reviewable milestones over approximately two weeks. Adjust timing and scope before publishing.",
    } satisfies JobBuilderSuggestion;
  }

  async buildProposal(context: ProposalAssistantContext, emphasis?: string) {
    const matchingSkills = context.profile.skills.filter((skill) =>
      context.listing.skills.some(
        (required) => required.includes(skill) || skill.includes(required),
      ),
    );
    const relevantPortfolio = context.portfolio.filter((item) =>
      item.skills.some((skill) => context.listing.skills.includes(skill)),
    );
    const experience = relevantPortfolio.slice(0, 3).map((item) => item.title);
    const groundedLine = experience.length
      ? `My Klaveroq portfolio includes ${experience.join(", ")}, which demonstrates relevant delivery experience.`
      : matchingSkills.length
        ? `My profile includes relevant skills in ${matchingSkills.join(", ")}.`
        : "I will use a transparent delivery plan and validate each requirement against the job scope.";
    const focus = emphasis ? ` I will give particular attention to ${emphasis.trim()}.` : "";
    const total = context.listing.budgetMin;
    if (total < 2n)
      return {
        coverLetter: `I am proposing a structured delivery for ${context.listing.title}. ${groundedLine}${focus} I will keep progress reviewable and submit the required proof with the milestone.`,
        milestones: [
          {
            title: "Complete delivery and handoff",
            deliverable: `Complete ${context.listing.title}, resolve agreed feedback, and provide handoff materials.`,
            acceptanceCriteria:
              "All agreed requirements are complete, accessible, and documented for final client review.",
            evidenceRequirements:
              "Final deliverable links, change summary, and completion checklist.",
            deliveryDays: 14,
            amount: total.toString(),
          },
        ],
        relevantExperience: experience,
      };
    const firstAmount = (total * 40n) / 100n;
    const secondAmount = total - firstAmount;
    return {
      coverLetter: `I am proposing a structured delivery for ${context.listing.title}. ${groundedLine}${focus} I will keep progress reviewable and submit the required proof with each milestone.`,
      milestones: [
        {
          title: "Foundation and first review",
          deliverable: `Confirm the approach and deliver the first reviewable portion of ${context.listing.title}.`,
          acceptanceCriteria:
            "The approach addresses the listed requirements and the first delivery is ready for structured feedback.",
          evidenceRequirements: "Plan link and review-ready delivery URL or document.",
          deliveryDays: 7,
          amount: firstAmount.toString(),
        },
        {
          title: "Complete delivery and handoff",
          deliverable: `Complete ${context.listing.title}, resolve agreed feedback, and provide handoff materials.`,
          acceptanceCriteria:
            "All agreed requirements are complete, accessible, and documented for final client review.",
          evidenceRequirements:
            "Final deliverable links, change summary, and completion checklist.",
          deliveryDays: 14,
          amount: secondAmount.toString(),
        },
      ],
      relevantExperience: experience,
    };
  }
}
