"use client";

import { KeyRound, MonitorSmartphone, X } from "lucide-react";
import { useState } from "react";

type SessionRecord = {
  id: string;
  userAgent: string | null;
  lastSeenAt: Date | string;
  expiresAt: Date | string;
  current: boolean;
};

export function SessionList({ initialSessions }: { initialSessions: SessionRecord[] }) {
  const [records, setRecords] = useState(initialSessions);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function revoke(id: string) {
    setBusy(id);
    setError("");
    try {
      const response = await fetch(`/api/auth/sessions/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error?.message ?? "The session could not be revoked.");
      }
      setRecords((current) => current.filter((session) => session.id !== id));
      window.dispatchEvent(new Event("notifications:changed"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The session could not be revoked.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel security-history">
      <div className="section-heading">
        <div>
          <h2>Active sessions</h2>
          <p>Review devices signed in to your account</p>
        </div>
      </div>
      {records.length ? (
        records.map((session) => (
          <div className="session-row" key={session.id}>
            <span>
              {session.current ? <KeyRound size={17} /> : <MonitorSmartphone size={17} />}
            </span>
            <p>
              <strong>{session.userAgent || "Unknown client"}</strong>
              <small>
                {session.current
                  ? "Current session"
                  : `Last recorded ${new Date(session.lastSeenAt).toLocaleString()}`}
                {` · Expires ${new Date(session.expiresAt).toLocaleString()}`}
              </small>
            </p>
            {!session.current && (
              <button
                className="icon-button danger"
                aria-label="Revoke session"
                title="Revoke session"
                disabled={busy === session.id}
                onClick={() => revoke(session.id)}
              >
                <X size={17} />
              </button>
            )}
          </div>
        ))
      ) : (
        <p className="support-empty">No active session records are available.</p>
      )}
      {error && (
        <p className="form-feedback error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
