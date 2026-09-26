import { db } from "@/server/db";
import { jobListingMilestones, jobListings, operations } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { serialize } from "@/server/serialize";
import { listingInputSchema, listingQuerySchema } from "@/features/marketplace/server/schemas";
import { listPublicListings } from "@/features/marketplace/server/queries";
import { audit } from "@/server/audit";
import { eq } from "drizzle-orm";
import { requireIdempotencyKey, scopedIdempotencyKey } from "@/server/http/idempotency";

export const GET = withApi(async (request: Request) => {
  const url = new URL(request.url);
  const input = listingQuerySchema.parse(Object.fromEntries(url.searchParams));
  const result = await listPublicListings(input);
  const data = result.data.map(({ listing, client, proposalCount }) => {
    const { clientUserId: _clientUserId, awardedJobId: _awardedJobId, ...publicListing } = listing;
    void _clientUserId;
    void _awardedJobId;
    return { listing: publicListing, client, proposalCount: Number(proposalCount) };
  });
  return Response.json({ data: serialize(data), nextCursor: result.nextCursor });
});

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  const idempotencyKey = scopedIdempotencyKey(
    "create-listing",
    user.id,
    requireIdempotencyKey(request),
  );
  const [prior] = await db
    .select()
    .from(operations)
    .where(eq(operations.idempotencyKey, idempotencyKey))
    .limit(1);
  const priorListingId =
    prior?.metadata && typeof prior.metadata === "object" && "listingId" in prior.metadata
      ? String(prior.metadata.listingId)
      : null;
  if (priorListingId) {
    const [existing] = await db
      .select()
      .from(jobListings)
      .where(eq(jobListings.id, priorListingId))
      .limit(1);
    if (existing) return Response.json({ data: serialize(existing), idempotentReplay: true });
  }
  const input = listingInputSchema.parse(await request.json());
  const listing = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(jobListings)
      .values({
        title: input.title,
        description: input.description,
        category: input.category,
        skills: input.skills,
        proposalDeadline: input.proposalDeadline,
        budgetMin: BigInt(input.budgetMin),
        budgetMax: BigInt(input.budgetMax),
        clientUserId: user.id,
      })
      .returning();
    await tx.insert(jobListingMilestones).values(
      input.milestones.map((milestone, index) => ({
        ...milestone,
        listingId: created.id,
        sequence: index + 1,
      })),
    );
    await tx.insert(operations).values({
      initiatedBy: user.id,
      type: "CREATE_LISTING",
      idempotencyKey,
      status: "CONFIRMED",
      metadata: { listingId: created.id },
    });
    return created;
  });
  await audit(request, {
    actorUserId: user.id,
    action: "listing.created",
    entityType: "job_listing",
    entityId: listing.id,
  });
  return Response.json({ data: serialize(listing) }, { status: 201 });
});
