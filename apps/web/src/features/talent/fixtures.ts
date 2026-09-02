import type { z } from "zod";
import type { ReputationSummary } from "@/features/reputation/server/queries";
import type { talentQuerySchema } from "./server/schemas";

const now = new Date();

type PreviewTalent = {
  profile: {
    userId: string;
    displayName: string;
    headline: string;
    bio: string;
    primaryRole: string;
    skills: string[];
    experienceLevel: "EXPERT" | "INTERMEDIATE";
    yearsExperience: number;
    languages: string[];
    availability: "AVAILABLE" | "LIMITED";
    preferredWorkCategories: string[];
    countryCode: string;
    timezone: string;
    githubUrl: string | null;
    websiteUrl: string | null;
    linkedinUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  portfolio: Array<{
    id: string;
    title: string;
    description: string;
    projectUrl: string | null;
    githubUrl: string | null;
    skills: string[];
    projectRole: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  reputation: ReputationSummary;
};

export const previewTalent: PreviewTalent[] = [
  {
    profile: {
      userId: "preview-maya-chen",
      displayName: "Maya Chen",
      headline: "Frontend engineer building accessible data products",
      bio: "I design and build dependable frontend systems for data-heavy products, with a focus on accessibility, responsive behavior, and implementation clarity.",
      primaryRole: "Frontend engineering",
      skills: ["react", "typescript", "accessibility", "data visualization"],
      experienceLevel: "EXPERT",
      yearsExperience: 8,
      languages: ["english", "mandarin"],
      availability: "AVAILABLE",
      preferredWorkCategories: ["DEVELOPMENT"],
      countryCode: "CA",
      timezone: "America/Toronto",
      githubUrl: null,
      websiteUrl: null,
      linkedinUrl: null,
      createdAt: now,
      updatedAt: now,
    },
    portfolio: [
      {
        id: "preview-maya-analytics",
        title: "Accessible analytics workspace",
        description:
          "Built a responsive analytics workspace with keyboard-friendly filters, accessible data visualizations, and documented component states.",
        projectUrl: null,
        githubUrl: null,
        skills: ["react", "typescript", "accessibility", "data visualization"],
        projectRole: "Lead frontend engineer",
        createdAt: now,
        updatedAt: now,
      },
    ],
    reputation: {
      averageRating: 4.9,
      reviewCount: 18,
      completedJobs: 14,
      completedMilestones: 37,
      onTimeRate: 97,
      repeatClients: 5,
      verifiedWorkCount: 14,
      identityVerified: true,
    },
  },
  {
    profile: {
      userId: "preview-idris-bello",
      displayName: "Idris Bello",
      headline: "Product designer for complex financial workflows",
      bio: "I turn complex financial and operational workflows into calm, testable product experiences backed by research and coherent design systems.",
      primaryRole: "Product design",
      skills: ["product design", "figma", "ux research", "design systems"],
      experienceLevel: "EXPERT",
      yearsExperience: 9,
      languages: ["english", "yoruba"],
      availability: "LIMITED",
      preferredWorkCategories: ["DESIGN"],
      countryCode: "NG",
      timezone: "Africa/Lagos",
      githubUrl: null,
      websiteUrl: null,
      linkedinUrl: null,
      createdAt: now,
      updatedAt: new Date(now.getTime() - 86_400_000),
    },
    portfolio: [
      {
        id: "preview-idris-payouts",
        title: "Merchant payout service redesign",
        description:
          "Mapped payout operations, prototyped exception handling, and delivered a tested design system for merchant-facing workflows.",
        projectUrl: null,
        githubUrl: null,
        skills: ["product design", "figma", "ux research", "design systems"],
        projectRole: "Product designer",
        createdAt: now,
        updatedAt: now,
      },
    ],
    reputation: {
      averageRating: 4.8,
      reviewCount: 12,
      completedJobs: 10,
      completedMilestones: 29,
      onTimeRate: 94,
      repeatClients: 4,
      verifiedWorkCount: 10,
      identityVerified: true,
    },
  },
  {
    profile: {
      userId: "preview-sofia-alvarez",
      displayName: "Sofia Alvarez",
      headline: "Content designer focused on clear product guidance",
      bio: "I create useful product language for onboarding, complex decisions, validation, and recovery states across responsive digital services.",
      primaryRole: "Content design",
      skills: ["content design", "ux writing", "fintech", "research"],
      experienceLevel: "INTERMEDIATE",
      yearsExperience: 6,
      languages: ["english", "spanish"],
      availability: "AVAILABLE",
      preferredWorkCategories: ["WRITING", "DESIGN"],
      countryCode: "ES",
      timezone: "Europe/Madrid",
      githubUrl: null,
      websiteUrl: null,
      linkedinUrl: null,
      createdAt: now,
      updatedAt: new Date(now.getTime() - 172_800_000),
    },
    portfolio: [
      {
        id: "preview-sofia-onboarding",
        title: "Financial onboarding content system",
        description:
          "Created reusable onboarding, validation, and recovery patterns for a regulated financial product across responsive web flows.",
        projectUrl: null,
        githubUrl: null,
        skills: ["content design", "ux writing", "fintech"],
        projectRole: "Content designer",
        createdAt: now,
        updatedAt: now,
      },
    ],
    reputation: {
      averageRating: 4.7,
      reviewCount: 9,
      completedJobs: 8,
      completedMilestones: 21,
      onTimeRate: 100,
      repeatClients: 3,
      verifiedWorkCount: 8,
      identityVerified: true,
    },
  },
];

export function listPreviewTalent(input: z.infer<typeof talentQuerySchema>) {
  const query = input.query?.toLowerCase();
  const records = previewTalent.filter(({ profile, reputation }) => {
    if (
      query &&
      ![profile.displayName, profile.headline, profile.primaryRole, ...profile.skills].some(
        (value) => value.toLowerCase().includes(query),
      )
    )
      return false;
    if (input.skill && !profile.skills.includes(input.skill.toLowerCase())) return false;
    if (input.role && !profile.primaryRole.toLowerCase().includes(input.role.toLowerCase()))
      return false;
    if (input.category && !profile.preferredWorkCategories.includes(input.category)) return false;
    if (input.availability && profile.availability !== input.availability) return false;
    return reputation.completedJobs >= input.minCompletedJobs;
  });
  const sorted = [...records].sort((left, right) => {
    if (input.sort === "completed")
      return right.reputation.completedJobs - left.reputation.completedJobs;
    if (input.sort === "recent")
      return right.profile.updatedAt.getTime() - left.profile.updatedAt.getTime();
    return (
      (right.reputation.averageRating ?? 0) - (left.reputation.averageRating ?? 0) ||
      right.reputation.completedJobs - left.reputation.completedJobs
    );
  });

  return sorted.slice(0, input.limit).map(({ portfolio, ...record }) => ({
    ...record,
    portfolioPreview: portfolio.slice(0, 2),
  }));
}

export function getPreviewTalent(userId: string) {
  return previewTalent.find(({ profile }) => profile.userId === userId);
}
