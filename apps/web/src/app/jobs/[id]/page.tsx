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
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { AppShell } from "@/components/layout/app-shell";
import { agreementNextAction } from "@/features/jobs/next-action";
import { StatusBadge } from "@/components/ui/status-badge";
import { db } from "@/server/db";
import {
  disputes,
  disputeDecisions,
  disputeEvidence,
  disputeEvents,
  disputeFiles,
  jobs,
  marketplaceReviews,
  milestones,
  operations,
  profiles,
  proofFiles,
  proofSubmissions,
} from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/session";
import { ConfirmDraftButton } from "@/features/jobs/components/confirm-draft-button";
import { EngagementReview } from "@/features/reputation/components/engagement-review";
import { AgreementActions } from "@/features/jobs/components/agreement-actions";
import { DisputeWorkspace } from "@/features/jobs/components/dispute-workspace";

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
  const [items, existingReviews, proofs, proofFileRows, disputeRecords, cancellationOperations] =
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
      db
        .select({ file: proofFiles, proofId: proofSubmissions.id })
        .from(proofFiles)
        .innerJoin(proofSubmissions, eq(proofSubmissions.id, proofFiles.proofSubmissionId))
        .innerJoin(milestones, eq(milestones.id, proofSubmissions.milestoneId))
        .where(eq(milestones.jobId, id))
        .orderBy(desc(proofFiles.createdAt)),
      db.select().from(disputes).where(eq(disputes.jobId, id)).orderBy(desc(disputes.createdAt)),
      db
        .select()
        .from(operations)
        .where(and(eq(operations.jobId, id), eq(operations.type, "CANCELLATION_REQUEST")))
        .orderBy(desc(operations.createdAt))
        .limit(1),
    ]);
  const role = record.job.clientUserId === current.user.id ? "client" : "worker";
  const nextAction = agreementNextAction(
    record.job.status,
    role,
    items.map((item) => item.status),
  );
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
  const openDispute = disputeRecords.find((item) => !["RESOLVED", "CLOSED"].includes(item.status));
  const disputeIds = disputeRecords.map((item) => item.id);
  const [evidenceRows, disputeFileRows, eventRows, decisionRows, settlementRows] = disputeIds.length
    ? await Promise.all([
        db
          .select()
          .from(disputeEvidence)
          .where(inArray(disputeEvidence.disputeId, disputeIds))
          .orderBy(desc(disputeEvidence.createdAt)),
        db
          .select({ file: disputeFiles, disputeId: disputeEvidence.disputeId })
          .from(disputeFiles)
          .innerJoin(disputeEvidence, eq(disputeEvidence.id, disputeFiles.evidenceId))
          .where(inArray(disputeEvidence.disputeId, disputeIds)),
        db
          .select()
          .from(disputeEvents)
          .where(inArray(disputeEvents.disputeId, disputeIds))
          .orderBy(asc(disputeEvents.createdAt)),
        db.select().from(disputeDecisions).where(inArray(disputeDecisions.disputeId, disputeIds)),
        db
          .select()
          .from(operations)
          .where(and(eq(operations.jobId, id), eq(operations.type, "DISPUTE_SETTLEMENT"))),
      ])
    : [[], [], [], [], []];
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
      <section className="panel agreement-next" aria-labelledby="next-action-title">
        <p className="eyebrow">Next step · {role === "client" ? "Client" : "Worker"}</p>
        <h2 id="next-action-title">{nextAction.title}</h2>
        <p>{nextAction.detail}</p>
        <a
          className="secondary-button"
          href={
            record.job.status === "INVITED" || record.job.status === "AWAITING_FUNDING"
              ? "#agreement-milestones"
              : "#agreement-actions"
          }
        >
          {record.job.status === "INVITED" || record.job.status === "AWAITING_FUNDING"
            ? "Review agreed milestones"
            : "View available actions"}
        </a>
      </section>
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
          </section>
          <section className="panel technical-details">
            <p>
              <ShieldCheck size={16} aria-hidden="true" /> Payment integration is unavailable. Funds
              are not confirmed as protected.
            </p>
            <details>
              <summary>Payment record details</summary>
              <p>
                {record.job.fundedAt
                  ? `A funding timestamp was recorded on ${record.job.fundedAt.toLocaleDateString()}, but it has not been independently reconciled.`
                  : "No reconciled funding confirmation has been received."}
              </p>
            </details>
          </section>
          <section className="panel milestone-panel" id="agreement-milestones" tabIndex={-1}>
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
          <DisputeWorkspace
            disputes={disputeRecords.map((dispute) => {
              const decision = decisionRows.find((item) => item.disputeId === dispute.id);
              const settlement = settlementRows.find(
                (item) => (item.metadata as { decisionId?: string }).decisionId === decision?.id,
              );
              return {
                id: dispute.id,
                reference: dispute.reference,
                status: dispute.status,
                reasonCode: dispute.reasonCode,
                description: dispute.description,
                evidenceDueAt: dispute.evidenceDueAt.toISOString(),
                createdAt: dispute.createdAt.toISOString(),
                evidence: evidenceRows
                  .filter((item) => item.disputeId === dispute.id)
                  .map((item) => ({
                    id: item.id,
                    note: item.note,
                    author: item.submittedBy === record.job.clientUserId ? "Client" : "Worker",
                    createdAt: item.createdAt.toISOString(),
                    files: disputeFileRows
                      .filter((row) => row.file.evidenceId === item.id)
                      .map((row) => ({
                        id: row.file.id,
                        name: row.file.originalName,
                        sizeBytes: row.file.sizeBytes,
                      })),
                  })),
                events: eventRows
                  .filter((item) => item.disputeId === dispute.id)
                  .map((item) => ({
                    id: item.id,
                    detail: item.detail,
                    createdAt: item.createdAt.toISOString(),
                  })),
                decision: decision
                  ? {
                      workerShareBps: decision.workerShareBps,
                      clientRefundBps: decision.clientRefundBps,
                      rationale: decision.rationale,
                      approved: Boolean(decision.approvedAt),
                    }
                  : undefined,
                settlementStatus: settlement?.status,
              };
            })}
          />
          {record.job.status === "COMPLETED" && (
            <EngagementReview jobId={id} existing={existingReviews[0]} />
          )}
        </div>
        <aside className="detail-aside">
          <section className="panel next-action-card" id="agreement-actions" tabIndex={-1}>
            <p className="eyebrow">Next action</p>
            <h2>
              {record.job.status === "DRAFT"
                ? "Review agreement draft"
                : record.job.status === "INVITED" && role === "worker"
                  ? "Invitation confirmed"
                  : "Agreement actions"}
            </h2>
            {record.job.status === "INVITED" && role === "worker" && (
              <p>
                The client confirmed this invitation. Funding confirmation is required next; no
                acceptance or work is due yet.
              </p>
            )}
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
                        id: proof.id,
                        files: proofFileRows
                          .filter((row) => row.proofId === proof.id)
                          .map((row) => ({
                            id: row.file.id,
                            name: row.file.originalName,
                            sizeBytes: row.file.sizeBytes,
                          })),
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
