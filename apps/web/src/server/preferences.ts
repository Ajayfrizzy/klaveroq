import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { profiles, users, userPreferences, savedSearches, talentShortlistItems } from "./db/schema";
import { ApiError } from "./http/errors";
import {
  importSchema,
  normalizedQuery,
  type AccountPreferences,
} from "@/features/preferences/schema";

export async function readPreferences(userId: string): Promise<AccountPreferences> {
  const [focus, searches, shortlist] = await Promise.all([
    db.select().from(userPreferences).where(eq(userPreferences.userId, userId)),
    db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId))
      .orderBy(asc(savedSearches.createdAt)),
    db
      .select()
      .from(talentShortlistItems)
      .where(eq(talentShortlistItems.userId, userId))
      .orderBy(asc(talentShortlistItems.slot)),
  ]);
  return {
    workspaceFocus: (focus[0]?.workspaceFocus ?? "both") as AccountPreferences["workspaceFocus"],
    hasWorkspaceFocus: focus.length > 0,
    searches: searches.map(({ id, scope, name, query }) => ({
      id,
      scope: scope as "discover" | "talent",
      name,
      url: `/${scope}${query ? `?${query}` : ""}`,
    })),
    talentIds: shortlist.map((item) => item.talentUserId),
  };
}

// A user-row lock serializes inserts, deletes and imports. Slot constraints also
// enforce hard per-account limits at the database boundary under concurrency.
export async function savePreferences(
  userId: string,
  input: z.infer<typeof importSchema>,
  importing = false,
) {
  await db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    if (input.workspaceFocus) {
      const insert = tx
        .insert(userPreferences)
        .values({ userId, workspaceFocus: input.workspaceFocus });
      if (importing) await insert.onConflictDoNothing();
      else
        await insert.onConflictDoUpdate({
          target: userPreferences.userId,
          set: { workspaceFocus: input.workspaceFocus, updatedAt: new Date() },
        });
    }
    for (const search of input.searches) {
      const query = normalizedQuery(search);
      const rows = await tx
        .select()
        .from(savedSearches)
        .where(and(eq(savedSearches.userId, userId), eq(savedSearches.scope, search.scope)));
      const duplicate = rows.find((row) => row.query === query);
      if (duplicate) {
        if (!importing)
          await tx
            .update(savedSearches)
            .set({ name: search.name, updatedAt: new Date() })
            .where(eq(savedSearches.id, duplicate.id));
        continue;
      }
      const slot = Array.from({ length: 8 }, (_, i) => i).find(
        (i) => !rows.some((r) => r.slot === i),
      );
      if (slot === undefined)
        throw new ApiError(
          409,
          "SAVED_SEARCH_LIMIT",
          "You can save up to 8 searches per marketplace. Remove one and try again.",
        );
      await tx
        .insert(savedSearches)
        .values({ userId, scope: search.scope, name: search.name, query, slot });
    }
    for (const talentUserId of new Set(input.talentIds)) {
      if (talentUserId === userId)
        throw new ApiError(400, "SHORTLIST_SELF", "You cannot shortlist yourself.");
      const rows = await tx
        .select()
        .from(talentShortlistItems)
        .where(eq(talentShortlistItems.userId, userId));
      if (rows.some((r) => r.talentUserId === talentUserId)) continue;
      const [profile] = await tx
        .select({ id: profiles.userId })
        .from(profiles)
        .where(and(eq(profiles.userId, talentUserId), eq(profiles.isPublic, true)));
      if (!profile)
        throw new ApiError(
          404,
          "TALENT_UNAVAILABLE",
          "Profile no longer available. Remove it from the device shortlist before importing.",
        );
      const slot = [0, 1, 2].find((i) => !rows.some((r) => r.slot === i));
      if (slot === undefined)
        throw new ApiError(
          409,
          "SHORTLIST_LIMIT",
          "Compare up to 3 people. Remove someone before adding another.",
        );
      await tx.insert(talentShortlistItems).values({ userId, talentUserId, slot });
    }
  });
  return readPreferences(userId);
}

export async function removePreference(userId: string, kind: "search" | "talent", id: string) {
  await db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    if (kind === "search")
      await tx
        .delete(savedSearches)
        .where(and(eq(savedSearches.userId, userId), eq(savedSearches.id, id)));
    else
      await tx
        .delete(talentShortlistItems)
        .where(
          and(eq(talentShortlistItems.userId, userId), eq(talentShortlistItems.talentUserId, id)),
        );
  });
  return readPreferences(userId);
}
