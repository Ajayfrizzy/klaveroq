"use client";

import { Copy, KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { useState } from "react";

type Enrollment = { secret: string; otpauthUri: string; recoveryCodes: string[] };

export function MfaPanel({
  initialEnabled,
  recoveryCodesRemaining,
  passwordConfigured,
}: {
  initialEnabled: boolean;
  recoveryCodesRemaining: number;
  passwordConfigured: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [remaining, setRemaining] = useState(recoveryCodesRemaining);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password || undefined }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "MFA enrollment could not start.");
      setEnrollment(body.data);
      setPassword("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "MFA enrollment could not start.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(path: "confirm" | "disable") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/mfa/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "MFA could not be updated.");
      setEnabled(path === "confirm");
      if (path === "confirm" && enrollment) setRemaining(enrollment.recoveryCodes.length);
      setEnrollment(null);
      setCode("");
      window.dispatchEvent(new Event("notifications:changed"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "MFA could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel mfa-panel">
      <div className="section-heading">
        <div>
          <h2>Two-factor authentication</h2>
          <p>Authenticator app with single-use recovery codes</p>
        </div>
        {enabled ? <ShieldCheck size={20} /> : <KeyRound size={20} />}
      </div>
      {enabled ? (
        <div className="mfa-enabled">
          <p className="form-feedback success">Enabled · {remaining} recovery codes available.</p>
          <label>
            Authenticator or recovery code
            <input
              autoComplete="one-time-code"
              minLength={6}
              maxLength={40}
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <button
            className="secondary-button danger-text"
            disabled={busy || code.length < 6}
            onClick={() => submit("disable")}
          >
            <ShieldOff size={16} /> {busy ? "Disabling..." : "Disable MFA"}
          </button>
        </div>
      ) : enrollment ? (
        <div className="mfa-enrollment">
          <p>
            Add this setup key to an authenticator app, then store the recovery codes somewhere
            secure. Each recovery code works once.
          </p>
          <div className="mfa-secret">
            <code>{enrollment.secret}</code>
            <button
              className="icon-button"
              title="Copy setup key"
              aria-label="Copy setup key"
              onClick={() => navigator.clipboard.writeText(enrollment.secret)}
            >
              <Copy size={15} />
            </button>
          </div>
          <details>
            <summary>Manual authenticator URI</summary>
            <code>{enrollment.otpauthUri}</code>
          </details>
          <div className="recovery-codes" aria-label="Recovery codes">
            {enrollment.recoveryCodes.map((recoveryCode) => (
              <code key={recoveryCode}>{recoveryCode}</code>
            ))}
          </div>
          <label>
            Six-digit authenticator code
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <button
            className="primary-button"
            disabled={busy || !/^\d{6}$/.test(code)}
            onClick={() => submit("confirm")}
          >
            {busy ? "Confirming..." : "Confirm and enable"}
          </button>
        </div>
      ) : (
        <form className="mfa-start" onSubmit={start}>
          <p>Require a time-based code after your password whenever you sign in.</p>
          {passwordConfigured && (
            <label>
              Current password
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          )}
          <button className="primary-button" disabled={busy}>
            <ShieldCheck size={16} /> {busy ? "Starting..." : "Set up MFA"}
          </button>
        </form>
      )}
      {error && (
        <p className="form-feedback error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
