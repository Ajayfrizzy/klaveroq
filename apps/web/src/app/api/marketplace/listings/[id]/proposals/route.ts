import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  jobListings,
  notifications,
  operations,
  proposalMilestones,
  proposals,
} from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { serialize } from "@/server/serialize";
import {
  assertListingAcceptsProposals,
  requireListingOwner,
  requireProposalEligibility,
} from "@/features/marketplace/server/access";
import { proposalInputSchema } from "@/features/marketplace/server/schemas";
import { audit } from "@/server/audit";
import { getProposalEvaluations } from "@/features/marketplace/server/queries";

function isDuplicateProposal(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; constraint_name?: string; cause?: unknown };
  return (
    (record.code === "23505" && record.constraint_name === "proposal_listing_worker_unique") ||
    isDuplicateProposal(record.cause)
  );
}

export const GET = withApi(
  async (_request: Request, context: RouteContext<"/api/marketplace/listings/[id]/proposals">) => {
    const { id } = await context.params;
    const { user } = await requireUser();
    await requireListingOwner(id, user.id);
    const data = await getProposalEvaluations(id);
    return Response.json({ data: serialize(data) });
  },
);

export const POST = withApi(
  async (request: Request, context: RouteContext<"/api/marketplace/listings/[id]/proposals">) => {
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
    await requireProposalEligibility(user.id, user.emailVerifiedAt);
    const input = proposalInputSchema.parse(await request.json());
    const [listing] = await db.select().from(jobListings).where(eq(jobListings.id, id)).limit(1);
    if (!listing) throw new ApiError(404, "LISTING_NOT_FOUND", "Listing was not found.");
    assertListingAcceptsProposals(listing);
    if (listing.clientUserId === user.id)
      throw new ApiError(
        400,
        "SELF_PROPOSAL_NOT_ALLOWED",
        "You cannot propose on your own listing.",
      );
    if (BigInt(input.totalBid) < listing.budgetMin || BigInt(input.totalBid) > listing.budgetMax)
      throw new ApiError(400, "BID_OUTSIDE_BUDGET", "The bid must be within the listing budget.");
    const operationKey = `proposal:${user.id}:${key}`;
    const [prior] = await db
      .select()
      .from(operations)
      .where(eq(operations.idempotencyKey, operationKey))
      .limit(1);
    if (prior?.metadata && typeof prior.metadata === "object" && "proposalId" in prior.metadata)
      return Response.json({ data: prior.metadata, idempotentReplay: true });
    const [existing] = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(and(eq(proposals.listingId, id), eq(proposals.workerUserId, user.id)))
      .limit(1);
    if (existing)
      throw new ApiError(
        409,
        "PROPOSAL_ALREADY_EXISTS",
        "You already submitted a proposal for this listing. Edit or withdraw the existing proposal.",
      );
    const proposal = await db
      .transaction(async (tx) => {
        const [created] = await tx
          .insert(proposals)
          .values({
            listingId: id,
            workerUserId: user.id,
            coverLetter: input.coverLetter,
            totalBid: BigInt(input.totalBid),
            estimatedDurationDays: input.estimatedDurationDays,
          })
          .returning();
        await tx.insert(proposalMilestones).values(
          input.milestones.map((item, index) => ({
            ...item,
            amount: BigInt(item.amount),
            proposalId: created.id,
            sequence: index + 1,
          })),
        );
        await tx.insert(operations).values({
          initiatedBy: user.id,
          type: "SUBMIT_PROPOSAL",
          idempotencyKey: operationKey,
          status: "CONFIRMED",
          metadata: { proposalId: created.id, listingId: id },
        });
        await tx.insert(notifications).values({
          userId: listing.clientUserId,
          type: "PROPOSAL_RECEIVED",
          title: "New proposal received",
          body: `A worker submitted a proposal for ${listing.title}.`,
          href: `/discover/${id}`,
        });
        return created;
      })
      .catch((error: unknown) => {
        if (isDuplicateProposal(error))
          throw new ApiError(
            409,
            "PROPOSAL_ALREADY_EXISTS",
            "You already submitted a proposal for this listing. Edit or withdraw the existing proposal.",
          );
        throw error;
      });
    await audit(request, {
      actorUserId: user.id,
      action: "proposal.submitted",
      entityType: "proposal",
      entityId: proposal.id,
      metadata: { listingId: id },
    });
    return Response.json({ data: serialize(proposal) }, { status: 201 });
  },
);
