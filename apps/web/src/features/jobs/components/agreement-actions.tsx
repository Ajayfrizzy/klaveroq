"use client";

import { AlertTriangle, CheckCircle2, FileCheck2, LoaderCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type MilestoneAction = {
  id: string;
  title: string;
  status: string;
  latestProof?: { note: string; links: string[]; version: number };
};

export function AgreementActions({
  jobId,
  status,
  role,
  userId,
  milestones,
  cancellationRequestedBy,
  openDisputeReference,
}: {
  jobId: string;
  status: string;
  role: "client" | "worker";
  userId: string;
  milestones: MilestoneAction[];
  cancellationRequestedBy?: string;
  openDisputeReference?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [proof, setProof] = useState({ milestoneId: "", note: "", links: "" });
  const [revision, setRevision] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [dispute, setDispute] = useState({ milestoneId: "", reasonCode: "OTHER", description: "" });

  const act = async (key: string, url: string, body: unknown) => {
    setBusy(key);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message ?? "The action could not be completed.");
      setSuccess("The agreement record was updated.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The action could not be completed.");
    } finally {
      setBusy("");
    }
  };

  const actionableProofs = milestones.filter((item) =>
    role === "worker"
      ? ["ACTIVE", "REVISION_REQUESTED"].includes(item.status)
      : item.status === "UNDER_REVIEW",
  );
  const canRequestCancellation =
    (role === "client" && ["INVITED", "AWAITING_FUNDING"].includes(status)) ||
    status === "IN_PROGRESS";
  const canDispute = ["IN_PROGRESS", "COMPLETED", "CANCELLATION_PENDING"].includes(status);

  return (
    <div className="agreement-actions">
      {status === "DRAFT" && (
        <p className="agreement-status-note">
          This is an agreement draft created from the awarded proposal. It is not funded and does
          not represent an escrow payment.
        </p>
      )}
      {["INVITED", "AWAITING_FUNDING"].includes(status) && (
        <p className="agreement-status-note">
          Funding is unavailable until PactAgent provides an authoritative confirmation. Worker
          acceptance, proof submission, and milestone review remain locked.
        </p>
      )}
      {status === "FUNDED_AWAITING_ACCEPTANCE" && (
        <div className="agreement-blocked-action">
          <AlertTriangle size={17} />
          <p>
            A funding status is recorded, but acceptance is disabled in this standalone UI until
            that state can be reconciled with PactAgent.
          </p>
        </div>
      )}
      {openDisputeReference && (
        <p className="agreement-status-note">
          Dispute {openDisputeReference} is open for this agreement.
        </p>
      )}

      {role === "worker" && actionableProofs.length > 0 && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const links = proof.links
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean);
            void act("proof", `/api/milestones/${proof.milestoneId}/proofs`, {
              note: proof.note,
              links,
            });
          }}
        >
          <h3>Submit milestone proof</h3>
          <label>
            Milestone
            <select
              required
              value={proof.milestoneId}
              onChange={(event) => setProof({ ...proof, milestoneId: event.target.value })}
            >
              <option value="">Choose a milestone</option>
              {actionableProofs.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Completion note
            <textarea
              required
              minLength={10}
              rows={4}
              value={proof.note}
              onChange={(event) => setProof({ ...proof, note: event.target.value })}
            />
          </label>
          <label>
            Evidence links
            <textarea
              rows={3}
              value={proof.links}
              onChange={(event) => setProof({ ...proof, links: event.target.value })}
              placeholder="One https:// link per line"
            />
          </label>
          <button className="primary-button" disabled={busy === "proof"}>
            <FileCheck2 size={16} /> Submit proof
          </button>
        </form>
      )}

      {role === "client" &&
        actionableProofs.map((item) => (
          <section className="agreement-review-action" key={item.id}>
            <h3>Review: {item.title}</h3>
            {item.latestProof && (
              <div className="agreement-proof">
                <strong>Submission v{item.latestProof.version}</strong>
                <p>{item.latestProof.note}</p>
                {item.latestProof.links.map((link) => (
                  <a href={link} target="_blank" rel="noreferrer" key={link}>
                    {link}
                  </a>
                ))}
              </div>
            )}
            <label>
              Revision reason
              <textarea
                rows={3}
                minLength={10}
                value={revision}
                onChange={(event) => setRevision(event.target.value)}
                placeholder="Required only when requesting a revision"
              />
            </label>
            <div className="agreement-action-row">
              <button
                type="button"
                className="secondary-button"
                disabled={Boolean(busy) || revision.trim().length < 10}
                onClick={() =>
                  void act(`revision-${item.id}`, `/api/milestones/${item.id}/review`, {
                    decision: "REQUEST_REVISION",
                    reason: revision,
                  })
                }
              >
                <XCircle size={16} /> Request revision
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={Boolean(busy)}
                onClick={() =>
                  void act(`approve-${item.id}`, `/api/milestones/${item.id}/review`, {
                    decision: "APPROVE",
                  })
                }
              >
                <CheckCircle2 size={16} /> Approve work
              </button>
            </div>
            <small>Approval creates a pending release record only. It does not settle funds.</small>
          </section>
        ))}

      {status === "CANCELLATION_PENDING" && cancellationRequestedBy !== userId && (
        <section>
          <h3>Cancellation request</h3>
          <p>
            The other participant requested cancellation. A refund remains pending external
            settlement if accepted.
          </p>
          <div className="agreement-action-row">
            <button
              type="button"
              className="secondary-button"
              disabled={Boolean(busy)}
              onClick={() =>
                void act("decline-cancellation", `/api/jobs/${jobId}/cancellation`, {
                  action: "DECLINE",
                })
              }
            >
              Decline
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={Boolean(busy)}
              onClick={() =>
                void act("accept-cancellation", `/api/jobs/${jobId}/cancellation`, {
                  action: "ACCEPT",
                })
              }
            >
              Accept cancellation
            </button>
          </div>
        </section>
      )}

      {canRequestCancellation && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void act("cancel", `/api/jobs/${jobId}/cancellation`, {
              action: "REQUEST",
              reason: cancellationReason,
            });
          }}
        >
          <h3>{status === "IN_PROGRESS" ? "Request cancellation" : "Cancel invitation"}</h3>
          <label>
            Reason
            <textarea
              required
              minLength={10}
              rows={3}
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
            />
          </label>
          <button className="secondary-button" disabled={Boolean(busy)}>
            Submit cancellation
          </button>
        </form>
      )}

      {canDispute && !openDisputeReference && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void act("dispute", `/api/jobs/${jobId}/disputes`, {
              ...dispute,
              milestoneId: dispute.milestoneId || undefined,
            });
          }}
        >
          <h3>Open a dispute</h3>
          <label>
            Related milestone
            <select
              value={dispute.milestoneId}
              onChange={(event) => setDispute({ ...dispute, milestoneId: event.target.value })}
            >
              <option value="">Whole agreement</option>
              {milestones
                .filter((item) => !["RELEASED", "REFUNDED", "CANCELLED"].includes(item.status))
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.title}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Reason
            <select
              value={dispute.reasonCode}
              onChange={(event) => setDispute({ ...dispute, reasonCode: event.target.value })}
            >
              <option value="WORK_NOT_DELIVERED">Work not delivered</option>
              <option value="WORK_NOT_AS_AGREED">Work not as agreed</option>
              <option value="CLIENT_UNRESPONSIVE">Client unresponsive</option>
              <option value="UNAUTHORIZED_CHANGE">Unauthorized change</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label>
            Description
            <textarea
              required
              minLength={30}
              rows={4}
              value={dispute.description}
              onChange={(event) => setDispute({ ...dispute, description: event.target.value })}
            />
          </label>
          <button className="secondary-button" disabled={Boolean(busy)}>
            <AlertTriangle size={16} /> Open dispute
          </button>
        </form>
      )}

      {busy && (
        <p className="form-feedback">
          <LoaderCircle size={14} /> Updating agreement...
        </p>
      )}
      {error && (
        <p className="form-feedback error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="form-feedback success" role="status">
          {success}
        </p>
      )}
    </div>
  );
}
