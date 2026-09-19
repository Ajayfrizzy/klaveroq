import type { JOB_CATEGORIES } from "@klaveroq/domain";

export type JobBuilderSuggestion = {
  title: string;
  scope: string;
  category: (typeof JOB_CATEGORIES)[number];
  skills: string[];
  milestones: Array<{
    title: string;
    deliverable: string;
    acceptanceCriteria: string;
    evidenceRequirements: string;
    deliveryDays: number;
  }>;
  estimatedStructure: string;
};

export type ProposalAssistantSuggestion = {
  coverLetter: string;
  milestones: Array<{
    title: string;
    deliverable: string;
    acceptanceCriteria: string;
    evidenceRequirements: string;
    deliveryDays: number;
    amount: string;
  }>;
  relevantExperience: string[];
};

export type ProposalAssistantContext = {
  listing: {
    title: string;
    description: string;
    skills: string[];
    budgetMin: bigint;
    budgetMax: bigint;
  };
  profile: {
    displayName: string;
    headline: string | null;
    primaryRole: string | null;
    skills: string[];
    bio: string | null;
  };
  portfolio: Array<{
    title: string;
    description: string;
    skills: string[];
    projectRole: string | null;
  }>;
};
