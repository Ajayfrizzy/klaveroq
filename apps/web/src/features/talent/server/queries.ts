import { and, countDistinct, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/server/db";
import { jobs, marketplaceReviews, mediaFiles, portfolioItems, profiles } from "@/server/db/schema";
import { getReputationSummaries, getReputationSummary } from "@/features/reputation/server/queries";
import { canViewTalentProfile } from "./authorization";
import { toPublicPortfolioItem, toPublicTalentProfile } from "./public-profile";
import type { talentQuerySchema } from "./schemas";
import { decodeCursor, encodeCursor } from "@/server/pagination/cursor";

async function getTalentProfile(userId: string, actorUserId?: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile || !canViewTalentProfile(profile.isPublic, profile.userId, actorUserId)) return null;
  const [portfolio, reputation] = await Promise.all([
    db
      .select()
      .from(portfolioItems)
      .where(eq(portfolioItems.userId, userId))
      .orderBy(desc(portfolioItems.createdAt)),
    getReputationSummary(userId),
  ]);
  const mediaKeys = [profile.avatarKey, ...portfolio.map((item) => item.mediaKey)].filter(
    (key): key is string => Boolean(key),
  );
  const mediaRows = mediaKeys.length
    ? await db
        .select()
        .from(mediaFiles)
        .where(and(inArray(mediaFiles.storageKey, mediaKeys), eq(mediaFiles.scanStatus, "CLEAN")))
    : [];
  const mediaByKey = new Map(mediaRows.map((media) => [media.storageKey, media]));
  return {
    profile: toPublicTalentProfile(
      profile,
      profile.avatarKey ? mediaByKey.get(profile.avatarKey) : undefined,
    ),
    portfolio: portfolio.map((item) =>
      toPublicPortfolioItem(item, item.mediaKey ? mediaByKey.get(item.mediaKey) : undefined),
    ),
    reputation,
  };
}

export function getPublicTalent(userId: string) {
  return getTalentProfile(userId);
}

export function getTalentForViewer(userId: string, actorUserId?: string) {
  return getTalentProfile(userId, actorUserId);
}

export async function listTalent(input: z.infer<typeof talentQuerySchema>) {
  const completedWork = db
    .select({
      userId: jobs.workerUserId,
      completedJobs: countDistinct(jobs.id).as("completed_jobs"),
    })
    .from(jobs)
    .where(eq(jobs.status, "COMPLETED"))
    .groupBy(jobs.workerUserId)
    .as("completed_work");
  const reviewStats = db
    .select({
      userId: marketplaceReviews.subjectUserId,
      averageRating:
        sql<number>`coalesce(avg(${marketplaceReviews.rating}), 0)::double precision`.as(
          "average_rating",
        ),
    })
    .from(marketplaceReviews)
    .groupBy(marketplaceReviews.subjectUserId)
    .as("review_stats");
  const completedValue = sql<number>`coalesce(${completedWork.completedJobs}, 0)`;
  const ratingValue = sql<number>`coalesce(${reviewStats.averageRating}, 0)`;
  const conditions = [eq(profiles.isPublic, true)];
  if (input.query)
    conditions.push(
      or(
        ilike(profiles.displayName, `%${input.query}%`),
        ilike(profiles.headline, `%${input.query}%`),
        ilike(profiles.primaryRole, `%${input.query}%`),
        sql`${profiles.skills}::text ILIKE ${`%${input.query}%`}`,
      )!,
    );
  if (input.skill) conditions.push(sql`${profiles.skills} ? ${input.skill.toLowerCase()}`);
  if (input.role) conditions.push(ilike(profiles.primaryRole, `%${input.role}%`));
  if (input.category) conditions.push(sql`${profiles.preferredWorkCategories} ? ${input.category}`);
  if (input.availability) conditions.push(eq(profiles.availability, input.availability));
  if (input.minCompletedJobs) conditions.push(gte(completedValue, input.minCompletedJobs));
  if (input.cursor) {
    const cursor = decodeCursor(input.cursor)!;
    if (cursor.kind === "talent-reputation")
      conditions.push(
        or(
          lt(ratingValue, cursor.rating),
          and(eq(ratingValue, cursor.rating), lt(completedValue, cursor.completed)),
          and(
            eq(ratingValue, cursor.rating),
            eq(completedValue, cursor.completed),
            lt(profiles.userId, cursor.id),
          ),
        )!,
      );
    if (cursor.kind === "talent-completed")
      conditions.push(
        or(
          lt(completedValue, cursor.completed),
          and(eq(completedValue, cursor.completed), lt(profiles.userId, cursor.id)),
        )!,
      );
    if (cursor.kind === "talent-recent")
      conditions.push(
        or(
          lt(profiles.updatedAt, new Date(cursor.value)),
          and(eq(profiles.updatedAt, new Date(cursor.value)), lt(profiles.userId, cursor.id)),
        )!,
      );
  }

  const rankedRows = await db
    .select({ profile: profiles, averageRating: ratingValue, completedJobs: completedValue })
    .from(profiles)
    .leftJoin(completedWork, eq(completedWork.userId, profiles.userId))
    .leftJoin(reviewStats, eq(reviewStats.userId, profiles.userId))
    .where(and(...conditions))
    .orderBy(
      ...(input.sort === "recent"
        ? [desc(profiles.updatedAt), desc(profiles.userId)]
        : input.sort === "completed"
          ? [desc(completedValue), desc(profiles.userId)]
          : [desc(ratingValue), desc(completedValue), desc(profiles.userId)]),
    )
    .limit(input.limit + 1);
  const hasMore = rankedRows.length > input.limit;
  const pageRows = rankedRows.slice(0, input.limit);
  const profileRows = pageRows.map((row) => row.profile);
  const reputations = await getReputationSummaries(profileRows.map((profile) => profile.userId));
  const portfolioRows = profileRows.length
    ? await db
        .select()
        .from(portfolioItems)
        .where(
          sql`${portfolioItems.userId} in (${sql.join(
            profileRows.map((profile) => sql`${profile.userId}`),
            sql`, `,
          )})`,
        )
        .orderBy(desc(portfolioItems.createdAt))
    : [];
  const portfolioByUser = new Map<string, typeof portfolioRows>();
  for (const item of portfolioRows) {
    const items = portfolioByUser.get(item.userId) ?? [];
    if (items.length < 2) items.push(item);
    portfolioByUser.set(item.userId, items);
  }
  const mediaKeys = [
    ...profileRows.map((profile) => profile.avatarKey),
    ...portfolioRows.map((item) => item.mediaKey),
  ].filter((key): key is string => Boolean(key));
  const mediaRows = mediaKeys.length
    ? await db
        .select()
        .from(mediaFiles)
        .where(and(inArray(mediaFiles.storageKey, mediaKeys), eq(mediaFiles.scanStatus, "CLEAN")))
    : [];
  const mediaByKey = new Map(mediaRows.map((media) => [media.storageKey, media]));
  const data = profileRows.map((profile) => ({
    profile: toPublicTalentProfile(
      profile,
      profile.avatarKey ? mediaByKey.get(profile.avatarKey) : undefined,
    ),
    reputation: reputations.get(profile.userId)!,
    portfolioPreview: (portfolioByUser.get(profile.userId) ?? []).map((item) =>
      toPublicPortfolioItem(item, item.mediaKey ? mediaByKey.get(item.mediaKey) : undefined),
    ),
  }));
  const last = pageRows.at(-1);
  return {
    data,
    nextCursor:
      hasMore && last
        ? input.sort === "recent"
          ? encodeCursor({
              kind: "talent-recent",
              value: last.profile.updatedAt.toISOString(),
              id: last.profile.userId,
            })
          : input.sort === "completed"
            ? encodeCursor({
                kind: "talent-completed",
                completed: Number(last.completedJobs),
                id: last.profile.userId,
              })
            : encodeCursor({
                kind: "talent-reputation",
                rating: Number(last.averageRating),
                completed: Number(last.completedJobs),
                id: last.profile.userId,
              })
        : null,
  };
}
