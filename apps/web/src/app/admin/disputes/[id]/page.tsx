import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft, Clock3, Paperclip, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/admin-shell";
import { AdminDecisionForm } from "@/features/disputes/components/admin-decision-form";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import {
  disputeDecisions,
  disputeEvidence,
  disputeEvents,
  disputeFiles,
  disputes,
  jobs,
  operations,
  profiles,
  users,
} from "@/server/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminDisputePage({ params }: { params: Promise<{ id: string }> }) {
  const current = await getCurrentUser();
  if (!current) redirect("/admin/login");
  if (!["DISPUTE_ADMIN", "SUPER_ADMIN"].includes(current.user.systemRole))
    redirect("/admin/login?unauthorized=1");
  const { id } = await params;
  const [record] = await db
    .select({ dispute: disputes, job: jobs })
    .from(disputes)
    .innerJoin(jobs, eq(jobs.id, disputes.jobId))
    .where(eq(disputes.id, id))
    .limit(1);
  if (!record) notFound();
  const [evidence, files, events, decisions, settlement, adminRows] = await Promise.all([
    db
      .select()
      .from(disputeEvidence)
      .where(eq(disputeEvidence.disputeId, id))
      .orderBy(desc(disputeEvidence.createdAt)),
    db
      .select({ file: disputeFiles })
      .from(disputeFiles)
      .innerJoin(disputeEvidence, eq(disputeEvidence.id, disputeFiles.evidenceId))
      .where(eq(disputeEvidence.disputeId, id)),
    db
      .select()
      .from(disputeEvents)
      .where(eq(disputeEvents.disputeId, id))
      .orderBy(asc(disputeEvents.createdAt)),
    db.select().from(disputeDecisions).where(eq(disputeDecisions.disputeId, id)).limit(1),
    db
      .select()
      .from(operations)
      .where(eq(operations.idempotencyKey, `dispute-settlement:${id}`))
      .limit(1),
    db
      .select({ id: users.id, email: users.email, name: profiles.displayName })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(
        and(
          inArray(users.systemRole, ["DISPUTE_ADMIN", "SUPER_ADMIN"]),
          eq(users.status, "ACTIVE"),
        ),
      ),
  ]);
  const participantIds = [record.job.clientUserId, record.job.workerUserId].filter(
    (value): value is string => Boolean(value),
  );
  const participantProfiles = participantIds.length
    ? await db
        .select({ id: profiles.userId, name: profiles.displayName })
        .from(profiles)
        .where(inArray(profiles.userId, participantIds))
    : [];
  const names = new Map(participantProfiles.map((item) => [item.id, item.name]));
  const decision = decisions[0];
  return (
    <AdminShell active="disputes">
      <Link className="admin-back" href="/admin/disputes">
        <ArrowLeft size={15} /> Dispute queue
      </Link>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">{record.dispute.reference}</p>
          <h1>{record.job.title}</h1>
          <p>{record.dispute.reasonCode.toLowerCase().replaceAll("_", " ")}</p>
        </div>
        <span>
          <ShieldCheck size={18} /> {record.dispute.status.toLowerCase().replaceAll("_", " ")}
        </span>
      </header>
      <div className="dispute-admin-layout">
        <div>
          <section className="admin-surface dispute-case-summary">
            <div className="admin-section-head">
              <div>
                <h2>Participant statement</h2>
                <p>Opened {record.dispute.createdAt.toLocaleString()}</p>
              </div>
            </div>
            <p>{record.dispute.description}</p>
            <dl>
              <div>
                <dt>Client</dt>
                <dd>{names.get(record.job.clientUserId) ?? "Client"}</dd>
              </div>
              <div>
                <dt>Worker</dt>
                <dd>
                  {record.job.workerUserId
                    ? (names.get(record.job.workerUserId) ?? "Worker")
                    : "Unlinked"}
                </dd>
              </div>
              <div>
                <dt>Evidence closes</dt>
                <dd>{record.dispute.evidenceDueAt.toLocaleString()}</dd>
              </div>
            </dl>
          </section>
          <section className="admin-surface">
            <div className="admin-section-head">
              <div>
                <h2>Evidence</h2>
                <p>{evidence.length} submissions</p>
              </div>
            </div>
            <div className="dispute-evidence-list">
              {evidence.map((item) => (
                <div key={item.id}>
                  <strong>{names.get(item.submittedBy) ?? "Participant"}</strong>
                  <time>{item.createdAt.toLocaleString()}</time>
                  <p>{item.note}</p>
                  {files
                    .filter((row) => row.file.evidenceId === item.id)
                    .map((row) => (
                      <a href={`/api/dispute-files/${row.file.id}`} key={row.file.id}>
                        <Paperclip size={13} /> {row.file.originalName}
                      </a>
                    ))}
                </div>
              ))}
              {!evidence.length && <p>No evidence has been submitted.</p>}
            </div>
          </section>
          <section className="admin-surface dispute-history">
            <div className="admin-section-head">
              <div>
                <h2>Case history</h2>
                <p>Authoritative non-financial events</p>
              </div>
            </div>
            {events.map((event) => (
              <div key={event.id}>
                <span />
                <p>{event.detail}</p>
                <time>{event.createdAt.toLocaleString()}</time>
              </div>
            ))}
          </section>
        </div>
        <aside>
          <AdminDecisionForm
            disputeId={id}
            status={record.dispute.status}
            approvers={adminRows
              .filter((item) => item.id !== current.user.id)
              .map((item) => ({ id: item.id, name: item.name ?? item.email }))}
            decision={
              decision
                ? {
                    workerShareBps: decision.workerShareBps,
                    clientRefundBps: decision.clientRefundBps,
                    rationale: decision.rationale,
                    approved: Boolean(decision.approvedAt),
                  }
                : undefined
            }
            canApprove={decision?.requiredApproverId === current.user.id}
          />
          <section className="admin-surface settlement-status">
            <Clock3 size={17} />
            <div>
              <strong>Settlement status</strong>
              <p>{settlement[0]?.status ?? "Not initiated"}</p>
              <small>PactAgent confirmation required</small>
            </div>
          </section>
        </aside>
      </div>
    </AdminShell>
  );
}
