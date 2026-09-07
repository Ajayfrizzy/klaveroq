export default function PublicJobLoading() {
  return (
    <main className="listing-create" role="status" aria-label="Loading public job form">
      <span className="sr-only">Loading public job form</span>
      <div className="form-route-skeleton">
        <i className="form-skeleton-title" />
        <i className="form-skeleton-steps" />
        <i className="form-skeleton-body" />
      </div>
    </main>
  );
}
