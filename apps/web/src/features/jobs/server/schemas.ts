import { z } from "zod";

const amount = z.string().regex(/^[1-9][0-9]*$/, "Use a positive integer smallest-unit amount");
export const feeQuoteSchema = z.object({
  subtotal: amount,
  asset: z.string().trim().min(2).max(30).default("CKB"),
});
export const createJobSchema = z
  .object({
    title: z.string().trim().min(5).max(90),
    description: z.string().trim().min(20).max(5000),
    workerUserId: z.string().uuid().optional(),
    workerEmail: z
      .string()
      .email()
      .max(320)
      .transform((value) => value.toLowerCase())
      .optional(),
    asset: z.string().trim().min(2).max(30).default("CKB"),
    assetDecimals: z.number().int().min(0).max(18).default(8),
    feeQuoteId: z.string().uuid(),
    milestones: z
      .array(
        z.object({
          title: z.string().trim().min(2).max(120),
          description: z.string().trim().min(10).max(3000),
          acceptanceCriteria: z.string().trim().min(5).max(2000),
          amount,
          dueAt: z.coerce.date(),
          evidenceRequirements: z.string().trim().min(5).max(1000),
        }),
      )
      .min(1)
      .max(10),
  })
  .refine((value) => Boolean(value.workerUserId) !== Boolean(value.workerEmail), {
    path: ["workerUserId"],
    message: "Choose either a Klaveroq professional or an email invite.",
  });
export const submitProofSchema = z.object({
  note: z.string().trim().min(10).max(5000),
  links: z.array(z.string().url().max(2000)).max(10).default([]),
});
export const reviewSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVE") }),
  z.object({
    decision: z.literal("REQUEST_REVISION"),
    reason: z.string().trim().min(10).max(2000),
  }),
]);
export const openDisputeSchema = z.object({
  milestoneId: z.string().uuid().optional(),
  reasonCode: z.enum([
    "SCOPE_MISMATCH",
    "QUALITY",
    "DEADLINE",
    "NON_RESPONSE",
    "PAYMENT",
    "ACCOUNT_SECURITY",
    "OTHER",
  ]),
  description: z.string().trim().min(20).max(5000),
});
