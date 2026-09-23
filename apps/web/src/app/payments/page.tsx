import { ArrowDownLeft, ArrowUpRight, ReceiptText, RotateCcw } from "lucide-react";
import { desc, eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { jobs, operations } from "@/server/db/schema";

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
const ckb = (value: bigint) => new Intl.NumberFormat().format(Number(value) / 100_000_000);

export default async function PaymentsPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login?returnTo=%2Fpayments");
  const records = await db
    .select({ operation: operations, job: jobs })
    .from(operations)
    .innerJoin(jobs, eq(operations.jobId, jobs.id))
    .where(or(eq(jobs.clientUserId, current.user.id), eq(jobs.workerUserId, current.user.id)))
    .orderBy(desc(operations.createdAt))
    .limit(100);
  const confirmed = records.filter(
    ({ operation }) => operation.status === "CONFIRMED" && operation.amount !== null,
  );
  const currentMonth = new Date();
  const releases = confirmed.filter(
    ({ operation }) =>
      ["MILESTONE_RELEASE", "RELEASE"].includes(operation.type) &&
      operation.createdAt.getUTCMonth() === currentMonth.getUTCMonth() &&
      operation.createdAt.getUTCFullYear() === currentMonth.getUTCFullYear(),
  );
  const funding = confirmed.filter(({ operation }) => operation.type === "FUND");
  const total = (rows: typeof records) =>
    rows.reduce((sum, row) => sum + (row.operation.amount ?? 0n), 0n);
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
          <span>Confirmed funding</span>
          <strong>{funding.length ? `${ckb(total(funding))} CKB` : "Unavailable"}</strong>
          <small>
            {funding.length
              ? `Across ${funding.length} operation${funding.length === 1 ? "" : "s"}`
              : "No confirmed funding records"}
          </small>
        </article>
        <article>
          <span>Released this month</span>
          <strong>{releases.length ? `${ckb(total(releases))} CKB` : "Unavailable"}</strong>
          <small>
            {releases.length
              ? `${releases.length} confirmed settlement${releases.length === 1 ? "" : "s"}`
              : "No confirmed release records"}
          </small>
        </article>
        <article>
          <span>Platform fees</span>
          <strong>Unavailable</strong>
          <small>No authoritative fee settlement records</small>
        </article>
      </section>
      <section className="panel data-panel">
        <div className="section-heading">
          <div>
            <h2>Transaction history</h2>
            <p>Payment operations associated with your agreements</p>
          </div>
        </div>
        <div className="data-head payment-head">
          <span>Transaction</span>
          <span>Job</span>
          <span>Date</span>
          <span>Amount</span>
          <span>Status</span>
        </div>
        {records.length ? (
          records.map(({ operation, job }) => {
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
                    : `${ckb(operation.amount)} ${operation.asset ?? job.asset}`}
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
