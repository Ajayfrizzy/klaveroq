import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { jobListings, proposals } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { audit } from "@/server/audit";
import { notifyUser } from "@/server/notifications/service";

export const POST = withApi(
  async (request: Request, context: RouteContext<"/api/marketplace/proposals/[id]/reject">) => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const { user } = await requireUser();
    const [record] = await db
      .select({ proposal: proposals, listing: jobListings })
      .from(proposals)
      .innerJoin(jobListings, eq(proposals.listingId, jobListings.id))
      .where(and(eq(proposals.id, id), eq(jobListings.clientUserId, user.id)))
      .limit(1);
    if (!record) throw new ApiError(404, "PROPOSAL_NOT_FOUND", "Proposal was not found.");
    if (record.proposal.status !== "SUBMITTED")
      throw new ApiError(
        409,
        "PROPOSAL_STATE_CONFLICT",
        "This proposal can no longer be rejected.",
      );
    await db.transaction(async (tx) => {
      await tx
        .update(proposals)
        .set({ status: "REJECTED", decidedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(proposals.id, id), eq(proposals.status, "SUBMITTED")));
    });
    await notifyUser({
      userId: record.proposal.workerUserId,
      type: "PROPOSAL_REJECTED",
      category: "PROPOSAL",
      title: "Proposal update",
      body: `Your proposal for ${record.listing.title} was not selected.`,
      href: `/discover/${record.listing.id}`,
      dedupeKey: `proposal-rejected:${id}`,
    });
    await audit(request, {
      actorUserId: user.id,
      action: "proposal.rejected",
      entityType: "proposal",
      entityId: id,
    });
    return Response.json({ data: { id, status: "REJECTED" } });
  },
);
