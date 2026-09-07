import { MarketplaceHeader } from "@/features/marketplace/components/marketplace-header";

export default function TalentLoading() {
  return (
    <div className="market-page">
      <MarketplaceHeader />
      <main>
        <div className="page-skeleton" role="status" aria-label="Loading talent discovery">
          <span className="sr-only">Loading talent discovery</span>
          <div className="skeleton-market-title">
            <i />
            <i />
          </div>
          <div className="skeleton-toolbar" />
          <div className="skeleton-listings">
            {[1, 2, 3].map((item) => (
              <i key={item} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
