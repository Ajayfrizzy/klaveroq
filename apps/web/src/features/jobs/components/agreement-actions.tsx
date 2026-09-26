"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  LoaderCircle,
  Paperclip,
  X,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { uploadFormData } from "@/features/files/upload";
import { useWorkProtection } from "@/components/ui/use-work-protection";

type MilestoneAction = {
  id: string;
  title: string;
  status: string;
  latestProof?: {
    id: string;
    note: string;
    links: string[];
    version: number;
    files: { id: string; name: string; sizeBytes: number }[];
  };
};

function ProofFileUploader({
  proof,
  onComplete,
}: {
  proof: NonNullable<MilestoneAction["latestProof"]>;
  onComplete: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [controller, setController] = useState<AbortController | null>(null);
  async function upload() {
    if (!files.length) return;
    setError("");
    const nextController = new AbortController();
    setController(nextController);
    setProgress(0);
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    try {
      await uploadFormData(
        `/api/proofs/${proof.id}/files`,
        form,
        nextController.signal,
        setProgress,
      );
      onComplete();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Evidence files could not be uploaded.");
    } finally {
      setController(null);
      setProgress(null);
    }
  }
  return (
    <section className="proof-file-manager">
      <h3>Evidence files for submission v{proof.version}</h3>
      {proof.files.length > 0 && (
        <div className="proof-file-list">
          {proof.files.map((file) => (
            <a href={`/api/files/${file.id}`} key={file.id}>
              <Paperclip size={13} /> {file.name}
            </a>
          ))}
        </div>
      )}
      <label>
        Add evidence files
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
          onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
        />
      </label>
      {progress !== null && (
        <div
          className="upload-progress"
          role="progressbar"
          aria-label="Evidence upload progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ width: `${progress}%` }} />
          <small>{progress}%</small>
        </div>
      )}
      <div className="agreement-action-row">
        {controller ? (
          <button className="secondary-button" type="button" onClick={() => controller.abort()}>
            <X size={14} /> Cancel
          </button>
        ) : (
          <button
            className="secondary-button"
            type="button"
            disabled={!files.length}
            onClick={upload}
          >
            <Paperclip size={14} /> {error ? "Retry upload" : "Upload files"}
          </button>
        )}
      </div>
      {error && (
        <p className="form-feedback error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

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
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [proofProgress, setProofProgress] = useState<number | null>(null);
  const [proofController, setProofController] = useState<AbortController | null>(null);
  const [revision, setRevision] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [dispute, setDispute] = useState({ milestoneId: "", reasonCode: "OTHER", description: "" });
  const {
    root: workRoot,
    dirty: workDirty,
    status: workStatus,
  } = useWorkProtection(JSON.stringify({ revision, cancellationReason, dispute }), error);

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
      if (key.startsWith("revision-")) setRevision("");
      if (key === "cancel") setCancellationReason("");
      if (key === "dispute") setDispute({ milestoneId: "", reasonCode: "OTHER", description: "" });
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The action could not be completed.");
    } finally {
      setBusy("");
    }
  };

  const uploadProofFiles = async (proofId: string, files: File[]) => {
    if (!files.length) return;
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    const controller = new AbortController();
    setProofController(controller);
    setProofProgress(0);
    await uploadFormData(`/api/proofs/${proofId}/files`, form, controller.signal, setProofProgress);
    setProofController(null);
    setProofProgress(null);
  };

  const submitProof = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy("proof");
    setError("");
    setSuccess("");
    try {
      const links = proof.links
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
      const response = await fetch(`/api/milestones/${proof.milestoneId}/proofs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: proof.note, links }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message ?? "The proof could not be submitted.");
      try {
        await uploadProofFiles(result.data.id, proofFiles);
      } catch (reason) {
        setError(
          `${reason instanceof Error ? reason.message : "Files could not be uploaded."} The proof text was saved; use Add evidence files below to retry.`,
        );
        window.location.assign(`/jobs/${jobId}?proof=files-failed`);
        return;
      }
      window.location.assign(`/jobs/${jobId}?proof=submitted`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The proof could not be submitted.");
    } finally {
      setBusy("");
      setProofController(null);
      setProofProgress(null);
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
    <div className="agreement-actions" ref={workRoot}>
      {workDirty && workStatus}
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
        <form onSubmit={submitProof}>
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
          <label className="proof-file-picker">
            Evidence files
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
              onChange={(event) => setProofFiles(Array.from(event.target.files ?? []))}
            />
            <small>Up to 10 files, 25 MB each and 100 MB total.</small>
          </label>
          {proofFiles.length > 0 && <p>{proofFiles.map((file) => file.name).join(", ")}</p>}
          {proofProgress !== null && (
            <div
              className="upload-progress"
              role="progressbar"
              aria-label="Proof upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={proofProgress}
            >
              <span style={{ width: `${proofProgress}%` }} />
              <small>{proofProgress}%</small>
            </div>
          )}
          {proofController && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => proofController.abort()}
            >
              <X size={14} /> Cancel upload
            </button>
          )}
          <button className="primary-button" disabled={busy === "proof"}>
            <FileCheck2 size={16} /> Submit proof
          </button>
        </form>
      )}

      {role === "worker" &&
        milestones
          .filter((item) => item.status === "UNDER_REVIEW" && item.latestProof)
          .map((item) => (
            <ProofFileUploader
              key={item.id}
              proof={item.latestProof!}
              onComplete={() => window.location.reload()}
            />
          ))}

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
                {item.latestProof.files.map((file) => (
                  <a href={`/api/files/${file.id}`} key={file.id}>
                    <Paperclip size={13} /> {file.name} ({Math.ceil(file.sizeBytes / 1024)} KB)
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
