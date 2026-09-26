import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { jobListings } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { requireListingOwner } from "@/features/marketplace/server/access";
import { audit } from "@/server/audit";

export const POST = withApi(
  async (request: Request, context: RouteContext<"/api/marketplace/listings/[id]/close">) => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const { user } = await requireUser();
    const listing = await requireListingOwner(id, user.id);
    if (listing.status !== "OPEN")
      throw new ApiError(409, "LISTING_STATE_CONFLICT", "Only an open listing can be closed.");
    await db
      .update(jobListings)
      .set({ status: "CLOSED", closedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(jobListings.id, id), eq(jobListings.status, "OPEN")));
    await audit(request, {
      actorUserId: user.id,
      action: "listing.closed",
      entityType: "job_listing",
      entityId: id,
    });
    return Response.json({ data: { id, status: "CLOSED" } });
  },
);
