import { ArrowDownLeft, ArrowUpRight, ReceiptText, RotateCcw } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { formatAssetAmount, presentAssetTotals } from "@/features/dashboard/server/metrics";
import { getPaymentHistory, getUserFinancialSummary } from "@/features/payments/server/queries";
import { getCurrentUser } from "@/server/auth/session";

const icons = {
  MILESTONE_RELEASE: ArrowDownLeft,
  RELEASE: ArrowDownLeft,
  FUND: ArrowUpRight,
  REFUND: RotateCcw,
};
const labels: Record<string, string> = {
  MILESTONE_RELEASE: "Release",
  RELEASE: "Release",
  FUND: "Funding",
  REFUND: "Refund",
};
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const current = await getCurrentUser();
  if (!current) redirect("/login?returnTo=%2Fpayments");
  const requestedPage = Number((await searchParams).page ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [financials, history] = await Promise.all([
    getUserFinancialSummary(current.user.id),
    getPaymentHistory(current.user.id, page),
  ]);
  const funding = presentAssetTotals(financials.funding, "No confirmed funding operations");
  const released = presentAssetTotals(financials.released, "No confirmed releases this month");
  const totalPages = Math.max(1, Math.ceil(history.total / history.pageSize));
  return (
    <AppShell>
      <PageHeader
        eyebrow="Financial history"
        title="Payments"
        description="Track confirmed funding, releases, and refunds."
        icon={ReceiptText}
      />
      <section className="payment-stats">
        <article>
          <span>Currently secured</span>
          <strong>Unavailable</strong>
          <small>Awaiting reconciled PactAgent balances</small>
        </article>
        <article>
          <span>Confirmed funding history</span>
          <strong>{funding.value}</strong>
          <small>{funding.note}</small>
        </article>
        <article>
          <span>Released this month</span>
          <strong>{released.value}</strong>
          <small>{released.note}</small>
        </article>
      </section>
      <section className="panel data-panel">
        <div className="section-heading">
          <div>
            <h2>Transaction history</h2>
            <p>Payment operations associated with your agreements</p>
          </div>
          {totalPages > 1 && (
            <div>
              {page > 1 && <Link href={`/payments?page=${page - 1}`}>Previous</Link>}
              <span>
                Page {Math.min(page, totalPages)} of {totalPages}
              </span>
              {page < totalPages && <Link href={`/payments?page=${page + 1}`}>Next</Link>}
            </div>
          )}
        </div>
        <div className="data-head payment-head">
          <span>Transaction</span>
          <span>Job</span>
          <span>Date</span>
          <span>Amount</span>
          <span>Status</span>
        </div>
        {history.records.length ? (
          history.records.map(({ operation, job }) => {
            const Icon = icons[operation.type as keyof typeof icons] ?? ReceiptText;
            return (
              <div className="data-row payment-row" key={operation.id}>
                <div className="transaction-cell">
                  <span>
                    <Icon size={17} />
                  </span>
                  <p>
                    <strong>
                      {labels[operation.type] ?? operation.type.toLowerCase().replaceAll("_", " ")}
                    </strong>
                    <small>{operation.externalReference ?? operation.id}</small>
                  </p>
                </div>
                <strong>{job.title}</strong>
                <span>{operation.createdAt.toLocaleDateString()}</span>
                <strong>
                  {operation.amount === null
                    ? "Unavailable"
                    : `${formatAssetAmount(operation.amount, job.assetDecimals)} ${operation.asset ?? job.asset}`}
                </strong>
                <span
                  className={
                    operation.status === "CONFIRMED" ? "confirmed-badge" : "listing-status"
                  }
                >
                  {operation.status.toLowerCase()}
                </span>
              </div>
            );
          })
        ) : (
          <div className="market-empty account-empty">
            <ReceiptText size={26} />
            <h2>No payment records yet</h2>
            <p>Confirmed funding, release, and refund operations will appear here.</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
