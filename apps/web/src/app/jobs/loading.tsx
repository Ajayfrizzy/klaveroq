import { MarketplaceLayout } from "@/features/marketplace/components/marketplace-layout";
import { PageSkeleton } from "@/components/ui/page-skeleton";
export default function JobsLoading() {
  return (
    <MarketplaceLayout>
      <PageSkeleton />
    </MarketplaceLayout>
  );
}
