"use client";

import { AlertTriangle, Clock3, FileText, LoaderCircle, Paperclip, Scale } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { uploadFormData } from "@/features/files/upload";
import { useWorkProtection } from "@/components/ui/use-work-protection";

type DisputeRecord = {
  id: string;
  reference: string;
  status: string;
  reasonCode: string;
  description: string;
  evidenceDueAt: string;
  createdAt: string;
  evidence: {
    id: string;
    note: string;
    author: string;
    createdAt: string;
    files: { id: string; name: string; sizeBytes: number }[];
  }[];
  events: { id: string; detail: string; createdAt: string }[];
  decision?: {
    workerShareBps: number;
    clientRefundBps: number;
    rationale: string;
    approved: boolean;
  };
  settlementStatus?: string;
};

export function DisputeWorkspace({ disputes }: { disputes: DisputeRecord[] }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const {
    root: workRoot,
    status: workStatus,
    markSaved,
  } = useWorkProtection(
    JSON.stringify({ note, files: files.map((file) => [file.name, file.size, file.lastModified]) }),
    error,
  );

  async function submitEvidence(event: React.FormEvent, disputeId: string) {
    event.preventDefault();
    setBusy(disputeId);
    setError("");
    const form = new FormData();
    form.append("note", note);
    files.forEach((file) => form.append("files", file));
    try {
      await uploadFormData(
        `/api/disputes/${disputeId}/evidence`,
        form,
        new AbortController().signal,
        setProgress,
      );
      setNote("");
      setFiles([]);
      markSaved(JSON.stringify({ note: "", files: [] }));
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Evidence could not be submitted.");
    } finally {
      setBusy("");
      setProgress(null);
    }
  }

  if (!disputes.length) return null;
  return (
    <section className="panel dispute-participant-panel">
      <div ref={workRoot}>{workStatus}</div>
      <div className="section-heading">
        <div>
          <h2>Dispute record</h2>
          <p>Evidence, decisions, and the authoritative case history</p>
        </div>
      </div>
      {disputes.map((dispute) => {
        const evidenceOpen =
          ["OPEN", "EVIDENCE_COLLECTION"].includes(dispute.status) &&
          new Date(dispute.evidenceDueAt) > new Date();
        return (
          <article className="dispute-record" key={dispute.id}>
            <header>
              <div>
                <strong>{dispute.reference}</strong>
                <span>{dispute.reasonCode.toLowerCase().replaceAll("_", " ")}</span>
              </div>
              <span className={`mini-state state-${dispute.status.toLowerCase()}`}>
                {dispute.status.toLowerCase().replaceAll("_", " ")}
              </span>
            </header>
            <p>{dispute.description}</p>
            <small>
              <Clock3 size={13} /> Evidence deadline:{" "}
              {new Date(dispute.evidenceDueAt).toLocaleString()}
            </small>

            {evidenceOpen && (
              <form onSubmit={(event) => void submitEvidence(event, dispute.id)}>
                <h3>Add evidence</h3>
                <label>
                  Evidence note
                  <textarea
                    required
                    minLength={10}
                    maxLength={5000}
                    rows={4}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
                <label>
                  Supporting files
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
                    onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                  />
                  <small>Optional. Up to 10 files and 100 MB total.</small>
                </label>
                {progress !== null && (
                  <progress max={100} value={progress}>
                    {progress}%
                  </progress>
                )}
                <button className="secondary-button" disabled={Boolean(busy)}>
                  {busy === dispute.id ? <LoaderCircle size={15} /> : <Paperclip size={15} />}{" "}
                  Submit evidence
                </button>
              </form>
            )}
            {!evidenceOpen && !["RESOLVED", "CLOSED"].includes(dispute.status) && (
              <p className="agreement-status-note">
                <AlertTriangle size={15} /> Evidence collection is closed while the case is
                reviewed.
              </p>
            )}
            {error && busy === "" && (
              <p className="form-feedback error" role="alert">
                {error}
              </p>
            )}

            <div className="dispute-evidence-list">
              <h3>
                <FileText size={16} /> Evidence history
              </h3>
              {dispute.evidence.length ? (
                dispute.evidence.map((entry) => (
                  <div key={entry.id}>
                    <strong>{entry.author}</strong>
                    <time>{new Date(entry.createdAt).toLocaleString()}</time>
                    <p>{entry.note}</p>
                    {entry.files.map((file) => (
                      <a href={`/api/dispute-files/${file.id}`} key={file.id}>
                        <Paperclip size={13} /> {file.name} ({Math.ceil(file.sizeBytes / 1024)} KB)
                      </a>
                    ))}
                  </div>
                ))
              ) : (
                <p>No participant evidence has been added yet.</p>
              )}
            </div>

            {dispute.decision && (
              <div className="dispute-decision">
                <h3>
                  <Scale size={16} />{" "}
                  {dispute.decision.approved
                    ? "Approved decision"
                    : "Decision awaiting second approval"}
                </h3>
                <p>{dispute.decision.rationale}</p>
                <dl>
                  <div>
                    <dt>Worker allocation</dt>
                    <dd>{dispute.decision.workerShareBps / 100}%</dd>
                  </div>
                  <div>
                    <dt>Client refund</dt>
                    <dd>{dispute.decision.clientRefundBps / 100}%</dd>
                  </div>
                  <div>
                    <dt>Settlement</dt>
                    <dd>{dispute.settlementStatus ?? "Not initiated"}</dd>
                  </div>
                </dl>
                <small>
                  PactAgent confirmation is required before any settlement is treated as complete.
                </small>
              </div>
            )}
            <div className="dispute-history">
              <h3>Case history</h3>
              {dispute.events.map((item) => (
                <div key={item.id}>
                  <span /> <p>{item.detail}</p>
                  <time>{new Date(item.createdAt).toLocaleString()}</time>
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </section>
  );
}
