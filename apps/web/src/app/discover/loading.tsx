import { PageSkeleton } from "@/components/ui/page-skeleton";
import { MarketplaceLayout } from "@/features/marketplace/components/marketplace-layout";
export default function DiscoverLoading() {
  return (
    <MarketplaceLayout>
      <PageSkeleton />
    </MarketplaceLayout>
  );
}
