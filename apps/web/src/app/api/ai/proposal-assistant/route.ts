import { desc, eq } from "drizzle-orm";
import { buildProposalSuggestion } from "@/features/ai/server/service";
import { proposalAssistantInputSchema } from "@/features/ai/schemas";
import { audit } from "@/server/audit";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { jobListings, portfolioItems, profiles } from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import {
  assertListingAcceptsProposals,
  requireProposalEligibility,
} from "@/features/marketplace/server/access";

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  const input = proposalAssistantInputSchema.parse(await request.json());
  const [listing, profile, portfolio] = await Promise.all([
    db.select().from(jobListings).where(eq(jobListings.id, input.listingId)).limit(1),
    db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1),
    db
      .select()
      .from(portfolioItems)
      .where(eq(portfolioItems.userId, user.id))
      .orderBy(desc(portfolioItems.createdAt))
      .limit(20),
  ]);
  if (!listing[0]) throw new ApiError(404, "LISTING_NOT_FOUND", "Listing was not found.");
  if (!profile[0]) throw new ApiError(409, "PROFILE_REQUIRED", "Complete your profile first.");
  assertListingAcceptsProposals(listing[0]);
  if (listing[0].clientUserId === user.id)
    throw new ApiError(
      400,
      "SELF_PROPOSAL_NOT_ALLOWED",
      "You cannot prepare a proposal for your own listing.",
    );
  await requireProposalEligibility(user.id, user.emailVerifiedAt);
  const suggestion = await buildProposalSuggestion(
    {
      listing: {
        title: listing[0].title,
        description: listing[0].description,
        skills: listing[0].skills,
        budgetMin: listing[0].budgetMin,
        budgetMax: listing[0].budgetMax,
      },
      profile: {
        displayName: profile[0].displayName,
        headline: profile[0].headline,
        primaryRole: profile[0].primaryRole,
        skills: profile[0].skills,
        bio: profile[0].bio,
      },
      portfolio,
    },
    input.emphasis,
  );
  await audit(request, {
    actorUserId: user.id,
    action: "ai.proposal_draft_generated",
    entityType: "proposal_draft",
    metadata: {
      listingId: input.listingId,
      provider: process.env.MARKETPLACE_AI_PROVIDER ?? "template",
    },
  });
  return Response.json({ data: suggestion });
});
