import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileCheck2,
  ShieldCheck,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { jobDetails } from "@/features/jobs/fixtures";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  jobs as jobsTable,
  marketplaceReviews,
  milestones as milestonesTable,
  profiles,
} from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/session";
import { ConfirmDraftButton } from "@/features/jobs/components/confirm-draft-button";
import { EngagementReview } from "@/features/reputation/components/engagement-review";

export function generateStaticParams() {
  return Object.keys(jobDetails).map((id) => ({ id }));
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = jobDetails[id as keyof typeof jobDetails];
  if (!detail) {
    const current = await getCurrentUser();
    if (!current) notFound();
    const [record] = await db
      .select({ job: jobsTable, clientName: profiles.displayName })
      .from(jobsTable)
      .innerJoin(profiles, eq(jobsTable.clientUserId, profiles.userId))
      .where(eq(jobsTable.id, id))
      .limit(1);
    if (
      !record ||
      (record.job.clientUserId !== current.user.id && record.job.workerUserId !== current.user.id)
    )
      notFound();
    const items = await db
      .select()
      .from(milestonesTable)
      .where(eq(milestonesTable.jobId, id))
      .orderBy(asc(milestonesTable.sequence));
    const [existingReview] = await db
      .select({ rating: marketplaceReviews.rating, comment: marketplaceReviews.comment })
      .from(marketplaceReviews)
      .where(
        and(
          eq(marketplaceReviews.jobId, id),
          eq(marketplaceReviews.reviewerUserId, current.user.id),
        ),
      )
      .limit(1);
    const role = record.job.clientUserId === current.user.id ? "client" : "worker";
    return (
      <AppShell>
        <div className="detail-back">
          <Link href="/jobs">
            <ArrowLeft size={16} /> All jobs
          </Link>
        </div>
        <div className="job-detail-heading">
          <div>
            <div className="detail-id">
              {record.job.reference} · You are the {role}
            </div>
            <h1>{record.job.title}</h1>
            <p>{record.job.description}</p>
          </div>
          <StatusBadge status={record.job.status} />
        </div>
        <div className="detail-layout">
          <div className="detail-main">
            <section className="panel overview-grid">
              <div>
                <span>
                  <UserRound size={16} /> Client
                </span>
                <strong>{record.clientName}</strong>
                <small>Klaveroq member</small>
              </div>
              <div>
                <span>
                  <WalletCards size={16} /> Agreement value
                </span>
                <strong>
                  {new Intl.NumberFormat().format(Number(record.job.subtotal) / 100_000_000)} CKB
                </strong>
                <small>Fee snapshot included</small>
              </div>
              <div>
                <span>
                  <CalendarDays size={16} /> Created
                </span>
                <strong>{record.job.createdAt.toLocaleDateString()}</strong>
                <small>{items.length} milestones</small>
              </div>
              <div>
                <span>
                  <ShieldCheck size={16} /> Protection
                </span>
                <strong>PactAgent escrow</strong>
                <small>Funds required before work begins</small>
              </div>
            </section>
            <section className="panel milestone-panel">
              <div className="section-heading">
                <div>
                  <h2>Milestones</h2>
                  <p>Terms from the accepted proposal</p>
                </div>
              </div>
              {items.map((item, index) => (
                <article className="milestone-row" key={item.id}>
                  <span className="milestone-number">{index + 1}</span>
                  <div>
                    <div className="milestone-title-line">
                      <h3>{item.title}</h3>
                      <span className={`mini-state state-${item.status.toLowerCase()}`}>
                        {item.status.toLowerCase()}
                      </span>
                    </div>
                    <p>
                      <FileCheck2 size={14} /> {item.description}
                    </p>
                    <small>
                      <CheckCircle2 size={13} /> Acceptance:{" "}
                      {item.acceptanceCriteria || "As agreed in the milestone terms"}
                    </small>
                    <small>
                      <Clock3 size={13} /> Required proof: {item.evidenceRequirements}
                    </small>
                  </div>
                  <div>
                    <strong>
                      {new Intl.NumberFormat().format(Number(item.amount) / 100_000_000)} CKB
                    </strong>
                    <span>Due {item.dueAt.toLocaleDateString()}</span>
                  </div>
                </article>
              ))}
            </section>
            {record.job.status === "COMPLETED" && (
              <EngagementReview jobId={id} existing={existingReview} />
            )}
          </div>
          <aside className="detail-aside">
            <section className="panel next-action-card">
              <p className="eyebrow">Next action</p>
              <h2>
                {record.job.status === "DRAFT" ? "Review agreement draft" : "Prepare funding"}
              </h2>
              <p>
                {record.job.status === "DRAFT"
                  ? "Confirm the accepted proposal terms before starting the existing funding flow."
                  : "The agreement is ready for protected funding."}
              </p>
              {record.job.status === "DRAFT" && role === "client" && (
                <ConfirmDraftButton jobId={id} />
              )}
            </section>
          </aside>
        </div>
      </AppShell>
    );
  }
  const { summary } = detail;
  return (
    <AppShell>
      <div className="detail-back">
        <Link href="/jobs">
          <ArrowLeft size={16} /> All jobs
        </Link>
      </div>
      <div className="job-detail-heading">
        <div>
          <div className="detail-id">
            {summary.id} · You are the {summary.role.toLowerCase()}
          </div>
          <h1>{summary.title}</h1>
          <p>{detail.description}</p>
        </div>
        <StatusBadge status={summary.displayStatus} />
      </div>
      <div className="detail-layout">
        <div className="detail-main">
          <section className="panel overview-grid">
            <div>
              <span>
                <UserRound size={16} /> Counterparty
              </span>
              <strong>{summary.counterparty}</strong>
              <small>Identity verified</small>
            </div>
            <div>
              <span>
                <WalletCards size={16} /> Secured value
              </span>
              <strong>{new Intl.NumberFormat().format(summary.total)} CKB</strong>
              <small>{new Intl.NumberFormat().format(summary.released)} CKB released</small>
            </div>
            <div>
              <span>
                <CalendarDays size={16} /> Created
              </span>
              <strong>{detail.createdAt}</strong>
              <small>Funded {detail.fundedAt}</small>
            </div>
            <div>
              <span>
                <ShieldCheck size={16} /> Protection
              </span>
              <strong>PactAgent escrow</strong>
              <small>Nervos CKB · Confirmed</small>
            </div>
          </section>
          <section className="panel milestone-panel" id="milestones">
            <div className="section-heading">
              <div>
                <h2>Milestones</h2>
                <p>{detail.milestones.length} funded outcomes</p>
              </div>
              <span className="progress-label">{summary.milestoneProgress}</span>
            </div>
            {detail.milestones.map((milestone, index) => (
              <article className="milestone-row" key={milestone.title}>
                <span
                  className={`milestone-number ${milestone.status === "RELEASED" ? "complete" : ""}`}
                >
                  {milestone.status === "RELEASED" ? <CheckCircle2 size={18} /> : index + 1}
                </span>
                <div>
                  <div className="milestone-title-line">
                    <h3>{milestone.title}</h3>
                    <span className={`mini-state state-${milestone.status.toLowerCase()}`}>
                      {milestone.status.toLowerCase().replaceAll("_", " ")}
                    </span>
                  </div>
                  <p>
                    <FileCheck2 size={14} /> Required proof: {milestone.evidence}
                  </p>
                  <small>
                    <Clock3 size={13} /> {milestone.note}
                  </small>
                </div>
                <div>
                  <strong>{new Intl.NumberFormat().format(milestone.amount)} CKB</strong>
                  <span>Due {milestone.due}</span>
                </div>
              </article>
            ))}
          </section>
          <section className="panel timeline-panel">
            <div className="section-heading">
              <div>
                <h2>Agreement activity</h2>
                <p>Authoritative and local events</p>
              </div>
              <Link href="/activity">
                View all <ExternalLink size={14} />
              </Link>
            </div>
            <div className="compact-event">
              <span />
              <p>
                <strong>Job funding confirmed</strong>
                <small>PactAgent confirmed the CKB transaction · {detail.fundedAt}</small>
              </p>
            </div>
            <div className="compact-event">
              <span />
              <p>
                <strong>Agreement created</strong>
                <small>Terms and milestone amounts locked · {detail.createdAt}</small>
              </p>
            </div>
          </section>
        </div>
        <aside className="detail-aside">
          <section className="panel next-action-card">
            <p className="eyebrow">Next action</p>
            <h2>{summary.nextAction}</h2>
            <p>Actions are enabled only when permitted by the authoritative agreement state.</p>
            <a className="primary-button" href="#milestones">
              Open current milestone
            </a>
          </section>
          <section className="panel destination-card">
            <h2>Payout destination</h2>
            <p>{detail.payoutAddress}</p>
            <button className="copy-row">
              <Copy size={14} /> Copy address
            </button>
            <small>The destination is snapshotted for this funded job.</small>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
