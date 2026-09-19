import { JOB_CATEGORIES } from "@klaveroq/domain";
import { z } from "zod";

const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);
const blankToNull = (value: unknown) => (value === "" || value === undefined ? null : value);
const optionalUrl = z.preprocess(blankToNull, z.string().trim().url().max(500).nullable());
const normalizedList = (maximum: number) =>
  z
    .array(z.string().trim().min(1).max(60))
    .max(maximum)
    .transform((items) => [...new Set(items.map((item) => item.toLowerCase()))]);

export const profileInputSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  headline: z.string().trim().min(5).max(160),
  bio: z.string().trim().min(40).max(5000),
  primaryRole: z.string().trim().min(2).max(100),
  skills: normalizedList(20),
  experienceLevel: z.enum(["ENTRY", "INTERMEDIATE", "EXPERT"]),
  yearsExperience: z.number().int().min(0).max(80).nullable(),
  languages: normalizedList(10),
  availability: z.enum(["AVAILABLE", "LIMITED", "UNAVAILABLE"]),
  timezone: z.string().trim().min(2).max(80),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
  preferredWorkCategories: z.array(z.enum(JOB_CATEGORIES)).max(JOB_CATEGORIES.length),
  githubUrl: optionalUrl,
  websiteUrl: optionalUrl,
  linkedinUrl: optionalUrl,
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
