import { z } from "zod";
import { listingQuerySchema } from "@/features/marketplace/server/schemas";
import { talentQuerySchema } from "@/features/talent/server/schemas";

export const focusSchema = z.enum(["hire", "work", "both"]);
export const scopeSchema = z.enum(["discover", "talent"]);
const searchBase = { name: z.string().trim().min(1).max(60) };
export const savedSearchSchema = z
  .discriminatedUnion("scope", [
    z
      .object({
        ...searchBase,
        scope: z.literal("discover"),
        parameters: listingQuerySchema.innerType().omit({ cursor: true, limit: true }).strict(),
      })
      .strict(),
    z
      .object({
        ...searchBase,
        scope: z.literal("talent"),
        parameters: talentQuerySchema.innerType().omit({ cursor: true, limit: true }).strict(),
      })
      .strict(),
  ])
  .superRefine((input, ctx) => {
    if (normalizedQuery(input).length > 2048)
      ctx.addIssue({ code: "custom", message: "Search parameters are too long." });
    if (
      input.scope === "discover" &&
      input.parameters.minBudget &&
      input.parameters.maxBudget &&
      BigInt(input.parameters.minBudget) > BigInt(input.parameters.maxBudget)
    )
      ctx.addIssue({ code: "custom", message: "Minimum budget cannot exceed maximum budget." });
  });
export const importSchema = z
  .object({
    workspaceFocus: focusSchema.optional(),
    searches: z.array(savedSearchSchema).max(16).default([]),
    talentIds: z.array(z.string().uuid().toLowerCase()).max(3).default([]),
  })
  .strict();

export function normalizedQuery(input: z.infer<typeof savedSearchSchema>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input.parameters).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (value === undefined || value === "" || value === 0) continue;
    if (key === "sort" && value === (input.scope === "discover" ? "newest" : "reputation"))
      continue;
    params.set(key, value instanceof Date ? value.toISOString() : String(value));
  }
  return params.toString();
}

export type AccountPreferences = {
  workspaceFocus: z.infer<typeof focusSchema>;
  hasWorkspaceFocus: boolean;
  searches: { id: string; scope: "discover" | "talent"; name: string; url: string }[];
  talentIds: string[];
};
