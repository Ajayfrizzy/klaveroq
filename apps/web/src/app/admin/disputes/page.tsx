import { desc, eq } from "drizzle-orm";
import { Scale } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/admin-shell";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { disputes, jobs } from "@/server/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminDisputesPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/admin/login");
  if (!["DISPUTE_ADMIN", "SUPER_ADMIN"].includes(current.user.systemRole))
    redirect("/admin/login?unauthorized=1");
  const rows = await db
    .select({ dispute: disputes, job: jobs })
    .from(disputes)
    .innerJoin(jobs, eq(jobs.id, disputes.jobId))
    .orderBy(desc(disputes.updatedAt));
  const active = rows.filter((row) => !["RESOLVED", "CLOSED"].includes(row.dispute.status)).length;
  return (
    <AdminShell active="disputes">
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Dispute queue</h1>
          <p>Review evidence and manage independently approved decisions.</p>
        </div>
        <span>
          <Scale size={18} /> {active} active
        </span>
      </header>
      <section className="admin-stats">
        <article>
          <span>Evidence collection</span>
          <strong>
            {rows.filter((row) => row.dispute.status === "EVIDENCE_COLLECTION").length}
          </strong>
        </article>
        <article>
          <span>Awaiting approval</span>
          <strong>{rows.filter((row) => row.dispute.status === "UNDER_REVIEW").length}</strong>
        </article>
        <article>
          <span>Resolved decisions</span>
          <strong>{rows.filter((row) => row.dispute.status === "RESOLVED").length}</strong>
        </article>
      </section>
      <section className="panel admin-ticket-table">
        <div className="admin-ticket-head dispute-queue-head">
          <span>Case</span>
          <span>Agreement</span>
          <span>Status</span>
          <span>Evidence deadline</span>
        </div>
        {!rows.length && <p className="support-empty">No disputes are available.</p>}
        {rows.map((row) => (
          <Link
            className="admin-ticket-row dispute-queue-row"
            href={`/admin/disputes/${row.dispute.id}`}
            key={row.dispute.id}
          >
            <div>
              <strong>{row.dispute.reference}</strong>
              <small>{row.dispute.reasonCode.toLowerCase().replaceAll("_", " ")}</small>
            </div>
            <div>
              <strong>{row.job.title}</strong>
              <small>{row.job.reference}</small>
            </div>
            <span className={`ticket-state state-${row.dispute.status.toLowerCase()}`}>
              {row.dispute.status.toLowerCase().replaceAll("_", " ")}
            </span>
            <time>{row.dispute.evidenceDueAt.toLocaleString()}</time>
          </Link>
        ))}
      </section>
    </AdminShell>
  );
}
