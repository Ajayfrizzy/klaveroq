import type { z } from "zod";
import type { listingQuerySchema } from "./server/schemas";

const day = 86_400_000;
const relativeDate = (daysFromNow: number) => new Date(Date.now() + daysFromNow * day);

type PreviewMarketplaceListing = {
  listing: {
    id: string;
    clientUserId: string;
    title: string;
    description: string;
    category: "DESIGN" | "DEVELOPMENT" | "WRITING";
    skills: string[];
    budgetMin: bigint;
    budgetMax: bigint;
    proposalDeadline: Date;
    status: "OPEN";
    publishedAt: Date;
    updatedAt: Date;
  };
  client: {
    displayName: string;
    headline: string;
    countryCode: string;
    bio: string;
  };
  proposalCount: number;
  milestones: Array<{
    id: string;
    sequence: number;
    title: string;
    deliverable: string;
    acceptanceCriteria: string;
    evidenceRequirements: string;
    deliveryDays: number;
  }>;
};

export const previewMarketplaceListings: PreviewMarketplaceListing[] = [
  {
    listing: {
      id: "preview-analytics-dashboard",
      clientUserId: "preview-client-northstar",
      title: "Build a responsive analytics dashboard",
      description:
        "Design and implement a responsive operations dashboard with accessible charts, filters, empty states, and a documented component handoff.",
      category: "DEVELOPMENT",
      skills: ["react", "typescript", "accessibility", "data visualization"],
      budgetMin: 120_000_000_000n,
      budgetMax: 180_000_000_000n,
      proposalDeadline: relativeDate(12),
      status: "OPEN",
      publishedAt: relativeDate(-1),
      updatedAt: relativeDate(-1),
    },
    client: {
      displayName: "Alex Morgan",
      headline: "Product leader for digital commerce teams",
      countryCode: "NG",
      bio: "I lead digital commerce products and work with specialists through clear, outcome-based milestones.",
    },
    proposalCount: 6,
    milestones: [
      {
        id: "preview-analytics-foundation",
        sequence: 1,
        title: "Dashboard foundation",
        deliverable:
          "Responsive application shell, navigation, design tokens, and documented data contracts.",
        acceptanceCriteria:
          "The shell works at agreed breakpoints and keyboard navigation follows the approved structure.",
        evidenceRequirements: "Preview URL, source commit, and responsive verification notes",
        deliveryDays: 7,
      },
      {
        id: "preview-analytics-interactions",
        sequence: 2,
        title: "Interactive dashboard",
        deliverable:
          "Accessible charts, filters, loading states, empty states, tests, and handoff notes.",
        acceptanceCriteria:
          "The agreed data states and interactions pass functional and accessibility review.",
        evidenceRequirements: "Final preview URL, test report, and completion walkthrough",
        deliveryDays: 21,
      },
    ],
  },
  {
    listing: {
      id: "preview-fintech-content",
      clientUserId: "preview-client-riverbank",
      title: "Create a fintech onboarding content system",
      description:
        "Develop concise onboarding copy, validation guidance, and reusable content patterns for a financial product across responsive web and mobile flows.",
      category: "WRITING",
      skills: ["ux writing", "fintech", "content design", "research"],
      budgetMin: 45_000_000_000n,
      budgetMax: 80_000_000_000n,
      proposalDeadline: relativeDate(8),
      status: "OPEN",
      publishedAt: relativeDate(-2),
      updatedAt: relativeDate(-2),
    },
    client: {
      displayName: "Kora Studio",
      headline: "Financial products made clear",
      countryCode: "NG",
      bio: "We build approachable financial tools for growing teams and value thoughtful, evidence-led delivery.",
    },
    proposalCount: 4,
    milestones: [
      {
        id: "preview-content-audit",
        sequence: 1,
        title: "Content audit and voice guide",
        deliverable:
          "Audit findings, content principles, terminology, and representative examples.",
        acceptanceCriteria: "The guide covers every agreed onboarding and recovery state.",
        evidenceRequirements: "Audit document and approved voice guide",
        deliveryDays: 6,
      },
      {
        id: "preview-content-system",
        sequence: 2,
        title: "Onboarding content system",
        deliverable: "Implementation-ready copy for the complete responsive onboarding journey.",
        acceptanceCriteria: "All reviewed states include final copy and documented rationale.",
        evidenceRequirements: "Content matrix and final prototype link",
        deliveryDays: 16,
      },
    ],
  },
  {
    listing: {
      id: "preview-checkout-research",
      clientUserId: "preview-client-meridian",
      title: "Research and redesign a checkout journey",
      description:
        "Identify friction in a multi-step checkout, validate the highest-impact improvements, and deliver an implementation-ready responsive prototype.",
      category: "DESIGN",
      skills: ["product design", "ux research", "figma", "prototyping"],
      budgetMin: 95_000_000_000n,
      budgetMax: 145_000_000_000n,
      proposalDeadline: relativeDate(15),
      status: "OPEN",
      publishedAt: relativeDate(-4),
      updatedAt: relativeDate(-3),
    },
    client: {
      displayName: "Meridian Retail",
      headline: "Commerce experiences for independent brands",
      countryCode: "GB",
      bio: "We help independent retailers deliver dependable customer experiences across their sales channels.",
    },
    proposalCount: 9,
    milestones: [
      {
        id: "preview-checkout-research-milestone",
        sequence: 1,
        title: "Journey research",
        deliverable: "Current-state audit, interview synthesis, and prioritized opportunity map.",
        acceptanceCriteria:
          "Findings connect observed friction to actionable design opportunities.",
        evidenceRequirements: "Research summary and annotated journey map",
        deliveryDays: 8,
      },
      {
        id: "preview-checkout-prototype",
        sequence: 2,
        title: "Validated checkout prototype",
        deliverable: "Responsive high-fidelity prototype covering primary and recovery paths.",
        acceptanceCriteria:
          "The prototype incorporates agreed findings and passes usability review.",
        evidenceRequirements: "Prototype, test notes, and component handoff",
        deliveryDays: 20,
      },
    ],
  },
];

const toListingSummary = ({ listing, client, proposalCount }: PreviewMarketplaceListing) => ({
  listing,
  client,
  proposalCount,
});

export function listPreviewMarketplaceListings(input: z.infer<typeof listingQuerySchema>) {
  const query = input.query?.toLowerCase();
  const data = previewMarketplaceListings.filter(({ listing }) => {
    if (
      query &&
      ![listing.title, listing.description, ...listing.skills].some((value) =>
        value.toLowerCase().includes(query),
      )
    )
      return false;
    if (input.category && listing.category !== input.category) return false;
    if (input.skill && !listing.skills.includes(input.skill.toLowerCase())) return false;
    if (input.minBudget && listing.budgetMax < BigInt(input.minBudget)) return false;
    if (input.maxBudget && listing.budgetMin > BigInt(input.maxBudget)) return false;
    if (input.deadlineBefore && listing.proposalDeadline > input.deadlineBefore) return false;
    return true;
  });
  const sorted = [...data].sort((left, right) =>
    input.sort === "budget"
      ? Number(right.listing.budgetMax - left.listing.budgetMax)
      : right.listing.publishedAt.getTime() - left.listing.publishedAt.getTime(),
  );
  const page = sorted.slice(0, input.limit);

  return {
    data: page.map(toListingSummary),
    nextCursor: null,
  };
}

export function getPreviewMarketplaceListing(id: string) {
  const record = previewMarketplaceListings.find(({ listing }) => listing.id === id);
  return record ? toListingSummary(record) : undefined;
}

export function getPreviewMarketplaceMilestones(id: string) {
  return previewMarketplaceListings.find(({ listing }) => listing.id === id)?.milestones ?? [];
}
