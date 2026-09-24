import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ListingWizard, type ListingDraft } from "@/features/marketplace/components/listing-wizard";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { jobListingMilestones, jobListings } from "@/server/db/schema";

export default async function PublicJobPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const { draft: draftId } = await searchParams;
  let initialDraft: ListingDraft | undefined;
  if (draftId) {
    const current = await getCurrentUser();
    if (!current) notFound();
    const [listing] = await db
      .select()
      .from(jobListings)
      .where(
        and(
          eq(jobListings.id, draftId),
          eq(jobListings.clientUserId, current.user.id),
          eq(jobListings.status, "DRAFT"),
        ),
      )
      .limit(1);
    if (!listing) notFound();
    const milestones = await db
      .select()
      .from(jobListingMilestones)
      .where(eq(jobListingMilestones.listingId, draftId))
      .orderBy(asc(jobListingMilestones.sequence));
    initialDraft = {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      category: listing.category,
      skills: listing.skills,
      budgetMin: listing.budgetMin.toString(),
      budgetMax: listing.budgetMax.toString(),
      proposalDeadline: listing.proposalDeadline.toISOString(),
      milestones: milestones.map((item) => ({
        title: item.title,
        deliverable: item.deliverable,
        acceptanceCriteria: item.acceptanceCriteria,
        evidenceRequirements: item.evidenceRequirements,
        deliveryDays: item.deliveryDays,
      })),
    };
  }
  return <ListingWizard initialDraft={initialDraft} />;
}
