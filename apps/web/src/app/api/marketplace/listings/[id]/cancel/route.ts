import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { jobListings } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { requireListingOwner } from "@/features/marketplace/server/access";
import { audit } from "@/server/audit";

export const POST = withApi(
  async (request: Request, context: RouteContext<"/api/marketplace/listings/[id]/cancel">) => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const { user } = await requireUser();
    const listing = await requireListingOwner(id, user.id);
    if (!["DRAFT", "OPEN", "CLOSED"].includes(listing.status))
      throw new ApiError(409, "LISTING_STATE_CONFLICT", "This listing cannot be cancelled.");
    await db
      .update(jobListings)
      .set({ status: "CANCELLED", closedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(jobListings.id, id), inArray(jobListings.status, ["DRAFT", "OPEN", "CLOSED"])));
    await audit(request, {
      actorUserId: user.id,
      action: "listing.cancelled",
      entityType: "job_listing",
      entityId: id,
      metadata: { previousStatus: listing.status },
    });
    return Response.json({ data: { id, status: "CANCELLED" } });
  },
);
