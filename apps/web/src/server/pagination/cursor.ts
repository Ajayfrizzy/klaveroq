import { z } from "zod";

const listingDateCursorSchema = z.object({
  kind: z.literal("listing-date"),
  value: z.string().datetime(),
  id: z.string().uuid(),
});
const listingBudgetCursorSchema = z.object({
  kind: z.literal("listing-budget"),
  value: z.string().regex(/^[0-9]+$/),
  id: z.string().uuid(),
});
const talentReputationCursorSchema = z.object({
  kind: z.literal("talent-reputation"),
  rating: z.number().min(0).max(5),
  completed: z.number().int().nonnegative(),
  id: z.string().uuid(),
});
const talentCompletedCursorSchema = z.object({
  kind: z.literal("talent-completed"),
  completed: z.number().int().nonnegative(),
  id: z.string().uuid(),
});
const talentRecentCursorSchema = z.object({
  kind: z.literal("talent-recent"),
  value: z.string().datetime(),
  id: z.string().uuid(),
});

export const paginationCursorSchema = z.discriminatedUnion("kind", [
  listingDateCursorSchema,
  listingBudgetCursorSchema,
  talentReputationCursorSchema,
  talentCompletedCursorSchema,
  talentRecentCursorSchema,
]);

export type PaginationCursor = z.infer<typeof paginationCursorSchema>;

export function encodeCursor(cursor: PaginationCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(value: string) {
  try {
    return paginationCursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
  } catch {
    return null;
  }
}
