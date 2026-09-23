import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  ShieldCheck,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { db } from "@/server/db";
import { jobs, marketplaceReviews, milestones, profiles } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/session";
import { ConfirmDraftButton } from "@/features/jobs/components/confirm-draft-button";
import { EngagementReview } from "@/features/reputation/components/engagement-review";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getCurrentUser();
  if (!current) notFound();
  const [record] = await db
    .select({ job: jobs, clientName: profiles.displayName })
    .from(jobs)
    .innerJoin(profiles, eq(jobs.clientUserId, profiles.userId))
    .where(eq(jobs.id, id))
    .limit(1);
  if (
    !record ||
    (record.job.clientUserId !== current.user.id && record.job.workerUserId !== current.user.id)
  )
    notFound();
  const [items, existingReviews] = await Promise.all([
    db.select().from(milestones).where(eq(milestones.jobId, id)).orderBy(asc(milestones.sequence)),
    db
      .select({ rating: marketplaceReviews.rating, comment: marketplaceReviews.comment })
      .from(marketplaceReviews)
      .where(
        and(
          eq(marketplaceReviews.jobId, id),
          eq(marketplaceReviews.reviewerUserId, current.user.id),
        ),
      )
      .limit(1),
  ]);
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
                {new Intl.NumberFormat().format(Number(record.job.subtotal) / 100_000_000)}{" "}
                {record.job.asset}
              </strong>
              <small>Recorded agreement amount</small>
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
              <small>
                {record.job.fundedAt
                  ? `Funding recorded ${record.job.fundedAt.toLocaleDateString()}`
                  : "Funding not confirmed"}
              </small>
            </div>
          </section>
          <section className="panel milestone-panel">
            <div className="section-heading">
              <div>
                <h2>Milestones</h2>
                <p>Terms from the agreement</p>
              </div>
            </div>
            {items.map((item, index) => (
              <article className="milestone-row" key={item.id}>
                <span
                  className={`milestone-number ${item.status === "RELEASED" ? "complete" : ""}`}
                >
                  {item.status === "RELEASED" ? <CheckCircle2 size={18} /> : index + 1}
                </span>
                <div>
                  <div className="milestone-title-line">
                    <h3>{item.title}</h3>
                    <span className={`mini-state state-${item.status.toLowerCase()}`}>
                      {item.status.toLowerCase().replaceAll("_", " ")}
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
                    {new Intl.NumberFormat().format(Number(item.amount) / 100_000_000)}{" "}
                    {record.job.asset}
                  </strong>
                  <span>Due {item.dueAt.toLocaleDateString()}</span>
                </div>
              </article>
            ))}
          </section>
          {record.job.status === "COMPLETED" && (
            <EngagementReview jobId={id} existing={existingReviews[0]} />
          )}
        </div>
        <aside className="detail-aside">
          <section className="panel next-action-card">
            <p className="eyebrow">Next action</p>
            <h2>
              {record.job.status === "DRAFT" ? "Review agreement draft" : "View agreement status"}
            </h2>
            <p>Actions are enabled only when permitted by the authoritative agreement state.</p>
            {record.job.status === "DRAFT" && role === "client" && (
              <ConfirmDraftButton jobId={id} />
            )}
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
