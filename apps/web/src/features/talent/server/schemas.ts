import { JOB_CATEGORIES } from "@klaveroq/domain";
import { z } from "zod";

const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);
const blankToNull = (value: unknown) => (value === "" || value === undefined ? null : value);
const optionalText = (maximum: number) =>
  z.preprocess(blankToNull, z.string().trim().max(maximum).nullable());
const optionalUrl = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .url()
    .max(500)
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
      message: "Use an http:// or https:// URL.",
    })
    .nullable(),
);
const normalizedList = (maximum: number) =>
  z
    .array(z.string().trim().min(1).max(60))
    .max(maximum)
    .transform((items) => [...new Set(items.map((item) => item.toLowerCase()))]);

export const profileInputSchema = z
  .object({
    displayName: z.string().trim().min(2).max(100).optional(),
    headline: optionalText(160).optional(),
    bio: optionalText(5000).optional(),
    primaryRole: optionalText(100).optional(),
    skills: normalizedList(20).optional(),
    experienceLevel: z.enum(["ENTRY", "INTERMEDIATE", "EXPERT"]).nullable().optional(),
    yearsExperience: z.number().int().min(0).max(80).nullable().optional(),
    languages: normalizedList(10).optional(),
    availability: z.enum(["AVAILABLE", "LIMITED", "UNAVAILABLE"]).optional(),
    timezone: optionalText(80).optional(),
    countryCode: z
      .preprocess(
        blankToNull,
        z
          .string()
          .trim()
          .length(2)
          .transform((value) => value.toUpperCase())
          .nullable(),
      )
      .optional(),
    preferredWorkCategories: z.array(z.enum(JOB_CATEGORIES)).max(JOB_CATEGORIES.length).optional(),
    githubUrl: optionalUrl.optional(),
    websiteUrl: optionalUrl.optional(),
    linkedinUrl: optionalUrl.optional(),
    makePrivateIfIncomplete: z.boolean().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).some((key) => key !== "makePrivateIfIncomplete"), {
    message: "Provide at least one profile field to update.",
  });

export const profileVisibilitySchema = z.object({ isPublic: z.boolean() });

export const portfolioInputSchema = z.object({
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().min(20).max(3000),
  projectUrl: optionalUrl,
  githubUrl: optionalUrl,
  skills: normalizedList(15),
  projectRole: z.preprocess(blankToNull, z.string().trim().max(120).nullable()),
});

export const talentQuerySchema = z.object({
  query: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
  skill: z.preprocess(blankToUndefined, z.string().trim().max(60).optional()),
  role: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
  category: z.preprocess(blankToUndefined, z.enum(JOB_CATEGORIES).optional()),
  availability: z.preprocess(
    blankToUndefined,
    z.enum(["AVAILABLE", "LIMITED", "UNAVAILABLE"]).optional(),
  ),
  minCompletedJobs: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(0).max(10_000).default(0),
  ),
  sort: z.preprocess(
    blankToUndefined,
    z.enum(["reputation", "completed", "recent"]).default("reputation"),
  ),
  limit: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(50).default(18)),
});
