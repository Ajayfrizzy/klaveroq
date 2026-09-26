import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/server/db";
import {
  jobListings,
  jobs,
  milestones,
  operations,
  proposalMilestones,
  proposals,
  users,
} from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { serialize } from "@/server/serialize";
import { calculateFees } from "@/features/payments/server/fee-engine";
import { audit } from "@/server/audit";
import { createJobReference } from "@/server/references";
import { notifyUser } from "@/server/notifications/service";

export const POST = withApi(
  async (request: Request, context: RouteContext<"/api/marketplace/proposals/[id]/award">) => {
    assertSameOrigin(request);
    const key = request.headers.get("idempotency-key");
    if (!key || key.length > 60)
      throw new ApiError(
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "Provide a valid Idempotency-Key header.",
      );
    const { id } = await context.params;
    const { user } = await requireUser();
    const operationKey = `award:${user.id}:${key}`;
    const [prior] = await db
      .select()
      .from(operations)
      .where(eq(operations.idempotencyKey, operationKey))
      .limit(1);
    if (prior?.jobId)
      return Response.json({ data: { jobId: prior.jobId }, idempotentReplay: true });
    const [record] = await db
      .select({ proposal: proposals, listing: jobListings, workerEmail: users.email })
      .from(proposals)
      .innerJoin(jobListings, eq(proposals.listingId, jobListings.id))
      .innerJoin(users, eq(proposals.workerUserId, users.id))
      .where(and(eq(proposals.id, id), eq(jobListings.clientUserId, user.id)))
      .limit(1);
    if (!record) throw new ApiError(404, "PROPOSAL_NOT_FOUND", "Proposal was not found.");
    if (
      record.proposal.status !== "SUBMITTED" ||
      !["OPEN", "CLOSED"].includes(record.listing.status)
    )
      throw new ApiError(409, "AWARD_STATE_CONFLICT", "This proposal cannot be awarded.");
    const proposalItems = await db
      .select()
      .from(proposalMilestones)
      .where(eq(proposalMilestones.proposalId, id))
      .orderBy(proposalMilestones.sequence);
    const losers = await db
      .select({ userId: proposals.workerUserId })
      .from(proposals)
      .where(
        and(
          eq(proposals.listingId, record.listing.id),
          ne(proposals.id, id),
          eq(proposals.status, "SUBMITTED"),
        ),
      );
    const fees = calculateFees(record.proposal.totalBid);
    const now = new Date();
    const reference = createJobReference();
    const job = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(jobListings)
        .set({ status: "AWARDED", closedAt: now, updatedAt: now })
        .where(
          and(
            eq(jobListings.id, record.listing.id),
            inArray(jobListings.status, ["OPEN", "CLOSED"]),
            isNull(jobListings.awardedJobId),
          ),
        )
        .returning();
      if (!claimed)
        throw new ApiError(
          409,
          "LISTING_ALREADY_AWARDED",
          "This listing has already been awarded.",
        );
      const [created] = await tx
        .insert(jobs)
        .values({
          reference,
          clientUserId: user.id,
          workerUserId: record.proposal.workerUserId,
          workerEmail: record.workerEmail,
          title: record.listing.title,
          description: record.listing.description,
          asset: record.listing.asset,
          assetDecimals: record.listing.assetDecimals,
          subtotal: fees.subtotal,
          clientFee: fees.clientFee,
          workerFeeBps: fees.workerFeeBps,
          networkReserve: fees.networkReserve,
          status: "DRAFT",
        })
        .returning();
      await tx.insert(milestones).values(
        proposalItems.map((item) => ({
          jobId: created.id,
          sequence: item.sequence,
          title: item.title,
          description: item.description,
          acceptanceCriteria: item.acceptanceCriteria,
          amount: item.amount,
          dueAt: new Date(now.getTime() + item.deliveryDays * 86_400_000),
          evidenceRequirements: item.evidenceRequirements,
        })),
      );
      await tx
        .update(jobListings)
        .set({ awardedJobId: created.id })
        .where(eq(jobListings.id, record.listing.id));
      await tx
        .update(proposals)
        .set({ status: "ACCEPTED", decidedAt: now, updatedAt: now })
        .where(eq(proposals.id, id));
      await tx
        .update(proposals)
        .set({ status: "REJECTED", decidedAt: now, updatedAt: now })
        .where(
          and(
            eq(proposals.listingId, record.listing.id),
            ne(proposals.id, id),
            eq(proposals.status, "SUBMITTED"),
          ),
        );
      await tx.insert(operations).values({
        jobId: created.id,
        initiatedBy: user.id,
        type: "AWARD_PROPOSAL",
        idempotencyKey: operationKey,
        status: "CONFIRMED",
        metadata: { proposalId: id, listingId: record.listing.id },
      });
      return created;
    });
    await notifyUser({
      userId: record.proposal.workerUserId,
      type: "PROPOSAL_ACCEPTED",
      category: "JOB",
      title: "Proposal accepted",
      body: `Your proposal for ${record.listing.title} was selected.`,
      href: `/jobs/${job.id}`,
      dedupeKey: `proposal-accepted:${id}`,
    });
    await Promise.all(
      losers.map((loser) =>
        notifyUser({
          userId: loser.userId,
          type: "PROPOSAL_REJECTED",
          category: "PROPOSAL",
          title: "Proposal update",
          body: `Another proposal was selected for ${record.listing.title}.`,
          href: `/discover/${record.listing.id}`,
          dedupeKey: `proposal-not-selected:${record.listing.id}:${loser.userId}`,
        }),
      ),
    );
    await audit(request, {
      actorUserId: user.id,
      action: "proposal.awarded",
      entityType: "proposal",
      entityId: id,
      metadata: { jobId: job.id, listingId: record.listing.id },
    });
    return Response.json({ data: serialize({ jobId: job.id, listingId: record.listing.id }) });
  },
);
