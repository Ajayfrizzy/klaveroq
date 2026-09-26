import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { jobListingMilestones, jobListings } from "@/server/db/schema";
import { getCurrentUser, requireUser } from "@/server/auth/session";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { serialize } from "@/server/serialize";
import { requireListingOwner } from "@/features/marketplace/server/access";
import { getPublicListing } from "@/features/marketplace/server/queries";
import { listingUpdateSchema } from "@/features/marketplace/server/schemas";
import { audit } from "@/server/audit";

export const GET = withApi(
  async (_request: Request, context: RouteContext<"/api/marketplace/listings/[id]">) => {
    const { id } = await context.params;
    const current = await getCurrentUser();
    const record = await getPublicListing(id, current?.user.id);
    if (!record) throw new ApiError(404, "LISTING_NOT_FOUND", "Listing was not found.");
    const { clientUserId: _clientUserId, awardedJobId: _awardedJobId, ...listing } = record.listing;
    void _clientUserId;
    void _awardedJobId;
    return Response.json({
      data: serialize({
        listing,
        client: record.client,
        proposalCount: Number(record.proposalCount),
      }),
    });
  },
);

export const PATCH = withApi(
  async (request: Request, context: RouteContext<"/api/marketplace/listings/[id]">) => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const { user } = await requireUser();
    const listing = await requireListingOwner(id, user.id);
    const input = listingUpdateSchema.parse(await request.json());
    if (listing.status !== "DRAFT")
      throw new ApiError(409, "LISTING_STATE_CONFLICT", "Only draft listings can be edited.");
    const nextMin = input.budgetMin ? BigInt(input.budgetMin) : listing.budgetMin;
    const nextMax = input.budgetMax ? BigInt(input.budgetMax) : listing.budgetMax;
    if (nextMax < nextMin)
      throw new ApiError(400, "BUDGET_INVALID", "Maximum budget must be at least the minimum.");
    const { milestones, ...fields } = input;
    const updated = await db.transaction(async (tx) => {
      const values = {
        ...fields,
        budgetMin: input.budgetMin ? BigInt(input.budgetMin) : undefined,
        budgetMax: input.budgetMax ? BigInt(input.budgetMax) : undefined,
        updatedAt: new Date(),
      };
      const [record] = await tx
        .update(jobListings)
        .set(values)
        .where(
          and(
            eq(jobListings.id, id),
            eq(jobListings.clientUserId, user.id),
            eq(jobListings.status, "DRAFT"),
          ),
        )
        .returning();
      if (!record)
        throw new ApiError(409, "LISTING_STATE_CONFLICT", "Only draft listings can be edited.");
      if (milestones) {
        await tx.delete(jobListingMilestones).where(eq(jobListingMilestones.listingId, id));
        await tx.insert(jobListingMilestones).values(
          milestones.map((milestone, index) => ({
            listingId: id,
            sequence: index + 1,
            ...milestone,
          })),
        );
      }
      return record;
    });
    await audit(request, {
      actorUserId: user.id,
      action: "listing.updated",
      entityType: "job_listing",
      entityId: id,
    });
    return Response.json({ data: serialize(updated) });
  },
);
