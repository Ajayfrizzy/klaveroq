import { JOB_CATEGORIES } from "@klaveroq/domain";
import { z } from "zod";
import { decodeCursor } from "../../../server/pagination/cursor";

const amount = z.string().regex(/^[1-9][0-9]*$/, "Use a positive integer smallest-unit amount");
const skills = z
  .array(z.string().trim().min(2).max(40))
  .max(10)
  .transform((items) => [...new Set(items.map((item) => item.toLowerCase()))]);
const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

const listingFieldsSchema = z.object({
  title: z.string().trim().min(5).max(90),
  description: z.string().trim().min(40).max(5000),
  category: z.enum(JOB_CATEGORIES),
  skills,
  budgetMin: amount,
  budgetMax: amount,
  proposalDeadline: z.coerce.date(),
});
export const listingMilestoneSchema = z.object({
  title: z.string().trim().min(2).max(120),
  deliverable: z.string().trim().min(10).max(3000),
  acceptanceCriteria: z.string().trim().min(5).max(2000),
  evidenceRequirements: z.string().trim().min(5).max(1000),
  deliveryDays: z.number().int().min(1).max(365),
});
export const listingInputSchema = listingFieldsSchema
  .extend({
    milestones: z.array(listingMilestoneSchema).min(1).max(10),
  })
  .refine((value) => BigInt(value.budgetMax) >= BigInt(value.budgetMin), {
    path: ["budgetMax"],
    message: "Maximum budget must be at least the minimum.",
  });

export const listingUpdateSchema = listingFieldsSchema
  .extend({ milestones: z.array(listingMilestoneSchema).min(1).max(10) })
  .partial()
  .refine(
    (value) =>
      !value.budgetMin || !value.budgetMax || BigInt(value.budgetMax) >= BigInt(value.budgetMin),
    {
      path: ["budgetMax"],
      message: "Maximum budget must be at least the minimum.",
    },
  );
export const listingQuerySchema = z
  .object({
    query: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
    category: z.preprocess(blankToUndefined, z.enum(JOB_CATEGORIES).optional()),
    skill: z.preprocess(blankToUndefined, z.string().trim().max(40).optional()),
    minBudget: z.preprocess(blankToUndefined, amount.optional()),
    maxBudget: z.preprocess(blankToUndefined, amount.optional()),
    deadlineBefore: z.preprocess(blankToUndefined, z.coerce.date().optional()),
    sort: z.preprocess(blankToUndefined, z.enum(["newest", "budget"]).default("newest")),
    cursor: z.preprocess(blankToUndefined, z.string().max(500).optional()),
    limit: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(50).default(12)),
  })
  .superRefine((input, context) => {
    if (!input.cursor) return;
    const cursor = decodeCursor(input.cursor);
    const expectedKind = input.sort === "budget" ? "listing-budget" : "listing-date";
    if (!cursor || cursor.kind !== expectedKind)
      context.addIssue({ code: "custom", path: ["cursor"], message: "Invalid pagination cursor." });
  });

export const proposalMilestoneSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(3000),
  acceptanceCriteria: z.string().trim().min(5).max(2000),
  amount,
  evidenceRequirements: z.string().trim().min(5).max(1000),
  deliveryDays: z.number().int().min(1).max(365),
});
export const proposalInputSchema = z
  .object({
    coverLetter: z.string().trim().min(40).max(5000),
    totalBid: amount,
    estimatedDurationDays: z.number().int().min(1).max(365),
    milestones: z.array(proposalMilestoneSchema).min(1).max(10),
  })
  .superRefine((value, context) => {
    if (
      value.milestones.reduce((sum, item) => sum + BigInt(item.amount), 0n) !==
      BigInt(value.totalBid)
    )
      context.addIssue({
        code: "custom",
        path: ["totalBid"],
        message: "Total bid must equal the milestone total.",
      });
    if (
      value.milestones.some(
        (item, index) => index > 0 && item.deliveryDays <= value.milestones[index - 1].deliveryDays,
      )
    )
      context.addIssue({
        code: "custom",
        path: ["milestones"],
        message: "Milestone delivery days must increase.",
      });
    if (value.milestones.at(-1)?.deliveryDays !== value.estimatedDurationDays)
      context.addIssue({
        code: "custom",
        path: ["estimatedDurationDays"],
        message: "Duration must match the final milestone delivery day.",
      });
  });

export const shortlistInputSchema = z.object({ shortlisted: z.boolean() });
export const proposalMessageInputSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});
