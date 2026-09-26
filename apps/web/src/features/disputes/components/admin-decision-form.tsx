"use client";

import { CheckCircle2, LoaderCircle, Scale } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminDecisionForm({
  disputeId,
  status,
  approvers,
  decision,
  canApprove,
}: {
  disputeId: string;
  status: string;
  approvers: { id: string; name: string }[];
  decision?: {
    workerShareBps: number;
    clientRefundBps: number;
    rationale: string;
    approved: boolean;
  };
  canApprove: boolean;
}) {
  const router = useRouter();
  const [workerPercent, setWorkerPercent] = useState(50);
  const [rationale, setRationale] = useState("");
  const [approverId, setApproverId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(body: unknown) {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/disputes/${disputeId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error?.message ?? "The decision could not be recorded.");
    else router.refresh();
    setBusy(false);
  }

  if (decision)
    return (
      <section className="admin-surface dispute-admin-decision">
        <div className="admin-section-head">
          <div>
            <h2>Proposed decision</h2>
            <p>{decision.approved ? "Independently approved" : "Awaiting independent approval"}</p>
          </div>
        </div>
        <p>{decision.rationale}</p>
        <dl>
          <div>
            <dt>Worker allocation</dt>
            <dd>{decision.workerShareBps / 100}%</dd>
          </div>
          <div>
            <dt>Client refund</dt>
            <dd>{decision.clientRefundBps / 100}%</dd>
          </div>
        </dl>
        {canApprove && !decision.approved && (
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => void submit({ action: "APPROVE" })}
          >
            {busy ? <LoaderCircle size={16} /> : <CheckCircle2 size={16} />} Approve decision
          </button>
        )}
        {!decision.approved && !canApprove && (
          <p className="agreement-status-note">
            Only the assigned second approver can approve this proposal.
          </p>
        )}
        {decision.approved && (
          <p className="agreement-status-note">
            Settlement remains pending until PactAgent confirms the outcome.
          </p>
        )}
        {error && (
          <p className="form-feedback error" role="alert">
            {error}
          </p>
        )}
      </section>
    );

  if (!["OPEN", "EVIDENCE_COLLECTION"].includes(status)) return null;
  return (
    <section className="admin-surface dispute-admin-decision">
      <div className="admin-section-head">
        <div>
          <h2>Propose decision</h2>
          <p>A different administrator must approve it.</p>
        </div>
      </div>
      <label>
        Worker allocation: {workerPercent}%
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={workerPercent}
          onChange={(event) => setWorkerPercent(Number(event.target.value))}
        />
      </label>
      <div className="decision-split">
        <span>Worker {workerPercent}%</span>
        <span>Client refund {100 - workerPercent}%</span>
      </div>
      <label>
        Decision rationale
        <textarea
          required
          minLength={30}
          maxLength={5000}
          rows={6}
          value={rationale}
          onChange={(event) => setRationale(event.target.value)}
        />
      </label>
      <label>
        Independent approver
        <select required value={approverId} onChange={(event) => setApproverId(event.target.value)}>
          <option value="">Select another administrator</option>
          {approvers.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="primary-button"
        disabled={busy || rationale.trim().length < 30 || !approverId}
        onClick={() =>
          void submit({
            action: "PROPOSE",
            workerShareBps: workerPercent * 100,
            clientRefundBps: (100 - workerPercent) * 100,
            rationale,
            requiredApproverId: approverId,
          })
        }
      >
        {busy ? <LoaderCircle size={16} /> : <Scale size={16} />} Submit for approval
      </button>
      <small>
        This records decision intent only. Settlement cannot complete without PactAgent
        confirmation.
      </small>
      {error && (
        <p className="form-feedback error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
