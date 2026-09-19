"use client";

import { BadgeCheck, Check, ExternalLink, FileCheck2, Star, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ProposalThread } from "./proposal-thread";

type Record = {
  proposal: {
    id: string;
    coverLetter: string;
    totalBid: string;
    estimatedDurationDays: number;
    status: string;
    shortlistedAt: Date | string | null;
  };
  worker: {
    userId: string;
    displayName: string;
    headline: string | null;
    bio: string | null;
    primaryRole: string | null;
    skills: string[];
    availability: string;
    countryCode: string | null;
  };
  reputation: {
    averageRating: number | null;
    reviewCount: number;
    completedJobs: number;
    completedMilestones: number;
    onTimeRate: number | null;
    repeatClients: number;
    verifiedWorkCount: number;
    identityVerified: boolean;
  };
  portfolioPreview: Array<{
    id: string;
    title: string;
    description: string;
    projectRole: string | null;
    skills: string[];
  }>;
  milestones: Array<{
    id: string;
    title: string;
    description: string;
    acceptanceCriteria: string;
    evidenceRequirements: string;
    amount: string;
    deliveryDays: number;
  }>;
};

export function ClientProposals({
  records,
  currentUserId,
}: {
  records: Record[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "shortlisted">("all");
  const visible = useMemo(
    () =>
      filter === "shortlisted"
        ? records.filter((record) => record.proposal.shortlistedAt)
        : records,
    [filter, records],
  );

  const act = async (id: string, action: "reject" | "award") => {
    if (action === "award" && !confirm("Award this proposal and create an agreement draft?"))
      return;
    setBusy(id);
    setError("");
    const response = await fetch(`/api/marketplace/proposals/${id}/${action}`, {
      method: "POST",
      headers: action === "award" ? { "Idempotency-Key": crypto.randomUUID() } : undefined,
    });
    const body = await response.json();
    if (!response.ok) setError(body.error?.message ?? "Action could not be completed.");
    else if (action === "award") router.push(`/jobs/${body.data.jobId}`);
    else router.refresh();
    setBusy("");
  };

  const shortlist = async (record: Record) => {
    setBusy(record.proposal.id);
    setError("");
    const response = await fetch(`/api/marketplace/proposals/${record.proposal.id}/shortlist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shortlisted: !record.proposal.shortlistedAt }),
    });
    const body = await response.json();
    if (!response.ok) setError(body.error?.message ?? "Shortlist could not be updated.");
    else router.refresh();
    setBusy("");
  };

  if (!records.length) return <div className="market-empty">No proposals have arrived yet.</div>;
  return (
    <div className="client-proposals">
      <div className="proposal-filter segmented" aria-label="Proposal filter">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
          All <span>{records.length}</span>
        </button>
        <button
          className={filter === "shortlisted" ? "active" : ""}
          onClick={() => setFilter("shortlisted")}
        >
          Shortlisted{" "}
          <span>{records.filter((record) => record.proposal.shortlistedAt).length}</span>
        </button>
      </div>
      {error && <p className="form-feedback error">{error}</p>}
      {!visible.length && (
        <div className="market-empty compact-empty">No shortlisted proposals yet.</div>
      )}
      {visible.map((record) => (
        <article
          className={record.proposal.shortlistedAt ? "shortlisted" : ""}
          key={record.proposal.id}
        >
          <div className="proposal-worker">
            <span>{record.worker.displayName.slice(0, 2).toUpperCase()}</span>
            <div>
              <div className="proposal-worker-name">
                <strong>{record.worker.displayName}</strong>
                {record.reputation.identityVerified && (
                  <BadgeCheck size={14} aria-label="Identity verified" />
                )}
              </div>
              <p>
                {record.worker.headline || record.worker.primaryRole || "Klaveroq professional"}
                {record.worker.countryCode ? ` · ${record.worker.countryCode}` : ""}
              </p>
            </div>
            <b className={`proposal-state state-${record.proposal.status.toLowerCase()}`}>
              {record.proposal.status.toLowerCase()}
            </b>
          </div>
          <div className="proposal-trust-row">
            <span>
              <Star size={14} fill={record.reputation.averageRating ? "currentColor" : "none"} />{" "}
              {record.reputation.averageRating?.toFixed(1) ?? "New"} (
              {record.reputation.reviewCount})
            </span>
            <span>{record.reputation.completedJobs} completed jobs</span>
            <span>{record.reputation.completedMilestones} released milestones</span>
            {record.reputation.onTimeRate !== null && (
              <span>{record.reputation.onTimeRate}% on time</span>
            )}
          </div>
          {record.worker.skills.length > 0 && (
            <div className="skill-list proposal-skills">
              {record.worker.skills.slice(0, 6).map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
          )}
          <p className="proposal-letter">{record.proposal.coverLetter}</p>
          {record.portfolioPreview.length > 0 && (
            <div className="proposal-portfolio-preview">
              <span>Relevant portfolio</span>
              {record.portfolioPreview.map((item) => (
                <div key={item.id}>
                  <strong>{item.title}</strong>
                  <small>{item.projectRole || item.description.slice(0, 100)}</small>
                </div>
              ))}
            </div>
          )}
          <div className="proposal-commercial">
            <div>
              <span>Bid</span>
              <strong>
                {new Intl.NumberFormat().format(
                  Number(BigInt(record.proposal.totalBid)) / 100_000_000,
                )}{" "}
                CKB
              </strong>
            </div>
            <div>
              <span>Delivery</span>
              <strong>{record.proposal.estimatedDurationDays} days</strong>
            </div>
            <div>
              <span>Milestones</span>
              <strong>{record.milestones.length}</strong>
            </div>
          </div>
          <ol>
            {record.milestones.map((item) => (
              <li key={item.id}>
                <span>Day {item.deliveryDays}</span>
                <p>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                  {item.acceptanceCriteria && (
                    <small>
                      <Check size={12} /> Acceptance: {item.acceptanceCriteria}
                    </small>
                  )}
                  <small>
                    <FileCheck2 size={12} /> Required proof: {item.evidenceRequirements}
                  </small>
                </p>
                <b>
                  {new Intl.NumberFormat().format(Number(BigInt(item.amount)) / 100_000_000)} CKB
                </b>
              </li>
            ))}
          </ol>
          <div className="proposal-secondary-actions">
            <Link href={`/talent/${record.worker.userId}`}>
              <ExternalLink size={14} /> View profile
            </Link>
            <button
              className={record.proposal.shortlistedAt ? "is-shortlisted" : ""}
              disabled={busy === record.proposal.id || record.proposal.status !== "SUBMITTED"}
              onClick={() => shortlist(record)}
            >
              <Star size={14} fill={record.proposal.shortlistedAt ? "currentColor" : "none"} />
              {record.proposal.shortlistedAt ? "Remove shortlist" : "Shortlist"}
            </button>
            <ProposalThread
              proposalId={record.proposal.id}
              currentUserId={currentUserId}
              closed={record.proposal.status !== "SUBMITTED"}
            />
          </div>
          {record.proposal.status === "SUBMITTED" && (
            <div className="proposal-actions">
              <button
                className="secondary-button"
                disabled={busy === record.proposal.id}
                onClick={() => act(record.proposal.id, "reject")}
              >
                <X size={16} /> Reject
              </button>
              <button
                className="primary-button"
                disabled={busy === record.proposal.id}
                onClick={() => act(record.proposal.id, "award")}
              >
                <Check size={16} /> Award proposal
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
