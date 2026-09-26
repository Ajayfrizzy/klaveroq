"use client";

import { AlertCircle, CheckCircle2, Clock3, ExternalLink, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type IdentityRecord = {
  id?: string;
  status: string;
  provider?: string;
  countryCode?: string | null;
  verifiedAt?: string | Date | null;
  expiresAt?: string | Date | null;
};

const copy: Record<string, { title: string; body: string }> = {
  NOT_STARTED: {
    title: "Identity check not started",
    body: "Start a verification with the configured identity provider.",
  },
  PENDING: {
    title: "Identity check pending",
    body: "Continue with the provider or wait while the submitted check is reviewed.",
  },
  VERIFIED: {
    title: "Identity verified",
    body: "Your current identity record is verified by the configured provider.",
  },
  REJECTED: {
    title: "Identity check unsuccessful",
    body: "The provider did not approve this check. You may start a new verification.",
  },
  REVIEW_REQUIRED: {
    title: "Identity review required",
    body: "The provider has sent this check for additional review.",
  },
  EXPIRED: {
    title: "Identity verification expired",
    body: "Start a new verification to refresh your identity status.",
  },
};

export function IdentityPanel({ record }: { record: IdentityRecord }) {
  const router = useRouter();
  const [countryCode, setCountryCode] = useState(record.countryCode ?? "NG");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const details = copy[record.status] ?? copy.NOT_STARTED;
  const canStart = ["NOT_STARTED", "REJECTED", "EXPIRED"].includes(record.status);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error?.message ?? "Identity verification could not start.");
      if (body.data?.redirectUrl) {
        window.location.assign(body.data.redirectUrl);
        return;
      }
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Identity verification could not start.");
      setBusy(false);
    }
  }

  const StatusIcon =
    record.status === "VERIFIED"
      ? CheckCircle2
      : record.status === "PENDING"
        ? Clock3
        : AlertCircle;
  return (
    <section className="panel identity-panel">
      <div className="identity-panel-heading">
        <span>
          <StatusIcon size={21} />
        </span>
        <div>
          <p className="eyebrow">Identity verification</p>
          <h2>{details.title}</h2>
          <p>{details.body}</p>
        </div>
      </div>
      {record.provider && (
        <dl className="identity-details">
          <div>
            <dt>Provider</dt>
            <dd>{record.provider}</dd>
          </div>
          <div>
            <dt>Country</dt>
            <dd>{record.countryCode ?? "Not recorded"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{record.status.toLowerCase().replaceAll("_", " ")}</dd>
          </div>
        </dl>
      )}
      {canStart && (
        <form className="identity-start-form" onSubmit={start}>
          <label>
            Country code
            <input
              required
              aria-label="Country code"
              autoComplete="country"
              minLength={2}
              maxLength={2}
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value.toUpperCase())}
            />
          </label>
          <button className="primary-button" disabled={busy}>
            <ShieldCheck size={16} /> {busy ? "Starting..." : "Start identity check"}
          </button>
        </form>
      )}
      {record.status === "PENDING" && record.provider === "sandbox" && (
        <a
          className="secondary-button"
          href={`/identity/sandbox?verificationId=${record.id}&country=${record.countryCode ?? ""}`}
        >
          <ExternalLink size={16} /> Continue sandbox check
        </a>
      )}
      {error && (
        <p className="form-feedback error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
