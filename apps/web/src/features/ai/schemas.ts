import { JOB_CATEGORIES } from "@klaveroq/domain";
import { z } from "zod";

export const jobBuilderInputSchema = z.object({
  description: z.string().trim().min(20).max(5000),
});

export const proposalAssistantInputSchema = z.object({
  listingId: z.string().uuid(),
  emphasis: z.string().trim().max(500).optional(),
});

const assistantMilestoneSchema = z.object({
  title: z.string().min(2).max(120),
  deliverable: z.string().min(10).max(3000),
  acceptanceCriteria: z.string().min(5).max(2000),
  evidenceRequirements: z.string().min(5).max(1000),
  deliveryDays: z.number().int().min(1).max(365),
});

export const jobBuilderOutputSchema = z.object({
  title: z.string().min(5).max(90),
  scope: z.string().min(40).max(5000),
  category: z.enum(JOB_CATEGORIES),
  skills: z.array(z.string().min(2).max(40)).max(10),
  milestones: z.array(assistantMilestoneSchema).min(1).max(10),
  estimatedStructure: z.string().min(10).max(500),
});

export const proposalAssistantOutputSchema = z.object({
  coverLetter: z.string().min(40).max(5000),
  milestones: z
    .array(
      assistantMilestoneSchema.extend({
        amount: z.string().regex(/^[1-9][0-9]*$/),
      }),
    )
    .min(1)
    .max(10),
  relevantExperience: z.array(z.string().min(2).max(200)).max(5),
});
