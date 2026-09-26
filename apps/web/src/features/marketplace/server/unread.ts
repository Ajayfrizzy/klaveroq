import { and, count, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { proposalMessages, proposalThreadReads } from "@/server/db/schema";

export async function getProposalUnreadCounts(proposalIds: string[], userId: string) {
  if (!proposalIds.length) return new Map<string, number>();
  const rows = await db
    .select({ proposalId: proposalMessages.proposalId, unread: count() })
    .from(proposalMessages)
    .leftJoin(
      proposalThreadReads,
      and(
        eq(proposalThreadReads.proposalId, proposalMessages.proposalId),
        eq(proposalThreadReads.userId, userId),
      ),
    )
    .where(
      and(
        inArray(proposalMessages.proposalId, proposalIds),
        ne(proposalMessages.senderUserId, userId),
        gt(
          proposalMessages.createdAt,
          sql`coalesce(${proposalThreadReads.lastReadAt}, to_timestamp(0))`,
        ),
      ),
    )
    .groupBy(proposalMessages.proposalId);
  return new Map(rows.map((row) => [row.proposalId, Number(row.unread)]));
}
