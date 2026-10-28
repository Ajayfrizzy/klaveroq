import { getPublicListing } from "./queries";
export async function publicListingMetadata({ params }: { params: Promise<{ id: string }> }) {
  const record = await getPublicListing((await params).id);
  return record
    ? { title: record.listing.title, description: record.listing.description.slice(0, 160) }
    : { title: "Job unavailable", robots: { index: false, follow: false } };
}
