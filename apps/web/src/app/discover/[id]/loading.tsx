import { MarketplaceHeader } from "@/features/marketplace/components/marketplace-header";

export default function ListingDetailLoading() {
  return (
    <div className="market-page">
      <MarketplaceHeader />
      <main>
        <div className="detail-route-skeleton" role="status" aria-label="Loading job details">
          <span className="sr-only">Loading job details</span>
          <div className="detail-skeleton-main">
            <i className="detail-skeleton-hero" />
            <i className="detail-skeleton-section" />
            <i className="detail-skeleton-section" />
          </div>
          <i className="detail-skeleton-aside" />
        </div>
      </main>
    </div>
  );
}
