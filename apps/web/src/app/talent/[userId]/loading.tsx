import { MarketplaceLayout } from "@/features/marketplace/components/marketplace-layout";

export default function TalentProfileLoading() {
  return (
    <MarketplaceLayout>
      <div className="detail-route-skeleton" role="status" aria-label="Loading talent profile">
        <span className="sr-only">Loading talent profile</span>
        <div className="detail-skeleton-main">
          <i className="detail-skeleton-hero" />
          <i className="detail-skeleton-section" />
          <i className="detail-skeleton-section" />
        </div>
        <i className="detail-skeleton-aside" />
      </div>
    </MarketplaceLayout>
  );
}
