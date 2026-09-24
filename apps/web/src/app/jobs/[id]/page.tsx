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
import { and, asc, desc, eq } from "drizzle-orm";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { db } from "@/server/db";
import {
  disputes,
  jobs,
  marketplaceReviews,
  milestones,
  operations,
  profiles,
  proofSubmissions,
} from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/session";
import { ConfirmDraftButton } from "@/features/jobs/components/confirm-draft-button";
import { EngagementReview } from "@/features/reputation/components/engagement-review";
import { AgreementActions } from "@/features/jobs/components/agreement-actions";

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
  const [items, existingReviews, proofs, disputeRecords, cancellationOperations] =
    await Promise.all([
      db
        .select()
        .from(milestones)
        .where(eq(milestones.jobId, id))
        .orderBy(asc(milestones.sequence)),
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
      db
        .select()
        .from(proofSubmissions)
        .innerJoin(milestones, eq(proofSubmissions.milestoneId, milestones.id))
        .where(eq(milestones.jobId, id))
        .orderBy(desc(proofSubmissions.version)),
      db.select().from(disputes).where(eq(disputes.jobId, id)).orderBy(desc(disputes.createdAt)),
      db
        .select()
        .from(operations)
        .where(and(eq(operations.jobId, id), eq(operations.type, "CANCELLATION_REQUEST")))
        .orderBy(desc(operations.createdAt))
        .limit(1),
    ]);
  const role = record.job.clientUserId === current.user.id ? "client" : "worker";
  const [workerProfile] = record.job.workerUserId
    ? await db
        .select({ displayName: profiles.displayName })
        .from(profiles)
        .where(eq(profiles.userId, record.job.workerUserId))
        .limit(1)
    : [];
  const latestProofs = new Map<string, (typeof proofs)[number]["proof_submissions"]>();
  for (const entry of proofs)
    if (!latestProofs.has(entry.proof_submissions.milestoneId))
      latestProofs.set(entry.proof_submissions.milestoneId, entry.proof_submissions);
  const cancellationMetadata = cancellationOperations[0]?.metadata as
    { requestedBy?: string } | undefined;
  const openDispute = disputeRecords.find((item) => item.status !== "RESOLVED");
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
                <UserRound size={16} /> Worker
              </span>
              <strong>{workerProfile?.displayName ?? record.job.workerEmail}</strong>
              <small>{record.job.workerUserId ? "Klaveroq member" : "Unlinked recipient"}</small>
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
              <strong>Payment integration unavailable</strong>
              <small>
                {record.job.fundedAt
                  ? `Legacy funding timestamp recorded ${record.job.fundedAt.toLocaleDateString()}; not independently reconciled`
                  : "No reconciled funding confirmation"}
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
            <AgreementActions
              jobId={id}
              status={record.job.status}
              role={role}
              userId={current.user.id}
              cancellationRequestedBy={cancellationMetadata?.requestedBy}
              openDisputeReference={openDispute?.reference}
              milestones={items.map((item) => {
                const proof = latestProofs.get(item.id);
                return {
                  id: item.id,
                  title: item.title,
                  status: item.status,
                  latestProof: proof
                    ? {
                        note: proof.note,
                        links: proof.links,
                        version: proof.version,
                      }
                    : undefined,
                };
              })}
            />
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
