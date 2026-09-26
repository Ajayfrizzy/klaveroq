import { and, asc, count, desc, eq, gt, gte, ilike, inArray, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  jobListings,
  portfolioItems,
  profiles,
  proposalMilestones,
  proposals,
} from "@/server/db/schema";
import { getReputationSummaries } from "@/features/reputation/server/queries";
import { toPublicPortfolioItem } from "@/features/talent/server/public-profile";
import type { z } from "zod";
import type { listingQuerySchema } from "./schemas";
import { decodeCursor, encodeCursor } from "@/server/pagination/cursor";

export async function listPublicListings(input: z.infer<typeof listingQuerySchema>) {
  const conditions = [eq(jobListings.status, "OPEN"), gt(jobListings.proposalDeadline, new Date())];
  if (input.query)
    conditions.push(
      or(
        ilike(jobListings.title, `%${input.query}%`),
        ilike(jobListings.description, `%${input.query}%`),
      )!,
    );
  if (input.category) conditions.push(eq(jobListings.category, input.category));
  if (input.skill) conditions.push(sql`${jobListings.skills} ? ${input.skill.toLowerCase()}`);
  if (input.minBudget) conditions.push(gte(jobListings.budgetMax, BigInt(input.minBudget)));
  if (input.maxBudget) conditions.push(lte(jobListings.budgetMin, BigInt(input.maxBudget)));
  if (input.deadlineBefore)
    conditions.push(lte(jobListings.proposalDeadline, input.deadlineBefore));
  if (input.cursor) {
    const cursor = decodeCursor(input.cursor)!;
    if (cursor.kind === "listing-budget")
      conditions.push(
        or(
          lt(jobListings.budgetMax, BigInt(cursor.value)),
          and(eq(jobListings.budgetMax, BigInt(cursor.value)), lt(jobListings.id, cursor.id)),
        )!,
      );
    if (cursor.kind === "listing-date")
      conditions.push(
        or(
          lt(jobListings.publishedAt, new Date(cursor.value)),
          and(eq(jobListings.publishedAt, new Date(cursor.value)), lt(jobListings.id, cursor.id)),
        )!,
      );
  }
  const proposalCounts = db
    .select({ listingId: proposals.listingId, value: count(proposals.id).as("proposal_count") })
    .from(proposals)
    .where(eq(proposals.status, "SUBMITTED"))
    .groupBy(proposals.listingId)
    .as("proposal_counts");
  const records = await db
    .select({
      listing: jobListings,
      client: {
        displayName: profiles.displayName,
        headline: profiles.headline,
        countryCode: profiles.countryCode,
      },
      proposalCount: sql<number>`coalesce(${proposalCounts.value}, 0)`,
    })
    .from(jobListings)
    .innerJoin(profiles, eq(jobListings.clientUserId, profiles.userId))
    .leftJoin(proposalCounts, eq(jobListings.id, proposalCounts.listingId))
    .where(and(...conditions))
    .orderBy(
      input.sort === "budget" ? desc(jobListings.budgetMax) : desc(jobListings.publishedAt),
      desc(jobListings.id),
    )
    .limit(input.limit + 1);
  const hasMore = records.length > input.limit;
  const data = records.slice(0, input.limit);
  const last = data.at(-1);
  return {
    data,
    nextCursor:
      hasMore && last
        ? input.sort === "budget"
          ? encodeCursor({
              kind: "listing-budget",
              value: last.listing.budgetMax.toString(),
              id: last.listing.id,
            })
          : encodeCursor({
              kind: "listing-date",
              value: last.listing.publishedAt!.toISOString(),
              id: last.listing.id,
            })
        : null,
  };
}

export async function getPublicListing(id: string, ownerUserId?: string) {
  const proposalCounts = db
    .select({ listingId: proposals.listingId, value: count(proposals.id).as("proposal_count") })
    .from(proposals)
    .where(eq(proposals.status, "SUBMITTED"))
    .groupBy(proposals.listingId)
    .as("proposal_counts");
  const [record] = await db
    .select({
      listing: jobListings,
      client: {
        displayName: profiles.displayName,
        headline: profiles.headline,
        countryCode: profiles.countryCode,
        bio: profiles.bio,
      },
      proposalCount: sql<number>`coalesce(${proposalCounts.value}, 0)`,
    })
    .from(jobListings)
    .innerJoin(profiles, eq(jobListings.clientUserId, profiles.userId))
    .leftJoin(proposalCounts, eq(jobListings.id, proposalCounts.listingId))
    .where(
      and(
        eq(jobListings.id, id),
        or(
          inArray(jobListings.status, ["OPEN", "CLOSED", "AWARDED"]),
          ownerUserId ? eq(jobListings.clientUserId, ownerUserId) : undefined,
        ),
      ),
    )
    .limit(1);
  return record;
}

export async function getProposalEvaluations(listingId: string) {
  const rows = await db
    .select({
      proposal: proposals,
      worker: {
        userId: profiles.userId,
        displayName: profiles.displayName,
        headline: profiles.headline,
        bio: profiles.bio,
        primaryRole: profiles.primaryRole,
        skills: profiles.skills,
        availability: profiles.availability,
        countryCode: profiles.countryCode,
      },
    })
    .from(proposals)
    .innerJoin(profiles, eq(proposals.workerUserId, profiles.userId))
    .where(eq(proposals.listingId, listingId))
    .orderBy(desc(proposals.shortlistedAt), asc(proposals.createdAt));
  const workerIds = rows.map((row) => row.worker.userId);
  const [reputations, portfolio, listing] = await Promise.all([
    getReputationSummaries(workerIds),
    workerIds.length
      ? db
          .select()
          .from(portfolioItems)
          .where(inArray(portfolioItems.userId, workerIds))
          .orderBy(desc(portfolioItems.createdAt))
      : [],
    db
      .select({ skills: jobListings.skills })
      .from(jobListings)
      .where(eq(jobListings.id, listingId))
      .limit(1),
  ]);
  const portfolioByWorker = new Map<string, typeof portfolio>();
  for (const item of portfolio) {
    const items = portfolioByWorker.get(item.userId) ?? [];
    items.push(item);
    portfolioByWorker.set(item.userId, items);
  }
  const requiredSkills = new Set(listing[0]?.skills ?? []);
  for (const [userId, items] of portfolioByWorker)
    portfolioByWorker.set(
      userId,
      items.sort(
        (left, right) =>
          right.skills.filter((skill) => requiredSkills.has(skill)).length -
          left.skills.filter((skill) => requiredSkills.has(skill)).length,
      ),
    );
  const milestoneRows = rows.length
    ? await db
        .select()
        .from(proposalMilestones)
        .where(
          inArray(
            proposalMilestones.proposalId,
            rows.map((row) => row.proposal.id),
          ),
        )
        .orderBy(asc(proposalMilestones.proposalId), asc(proposalMilestones.sequence))
    : [];
  const milestonesByProposal = new Map<string, typeof milestoneRows>();
  for (const milestone of milestoneRows) {
    const items = milestonesByProposal.get(milestone.proposalId) ?? [];
    items.push(milestone);
    milestonesByProposal.set(milestone.proposalId, items);
  }
  return rows.map((row) => ({
    ...row,
    reputation: reputations.get(row.worker.userId)!,
    portfolioPreview: (portfolioByWorker.get(row.worker.userId) ?? [])
      .slice(0, 2)
      .map((item) => toPublicPortfolioItem(item)),
    milestones: milestonesByProposal.get(row.proposal.id) ?? [],
  }));
}
