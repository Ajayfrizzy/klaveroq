"use client";

import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!token) return setError("The password reset link is missing its token.");
    if (password !== confirmation) return setError("The passwords do not match.");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "The password could not be reset.");
      setComplete(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The password could not be reset.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-panel auth-status-panel">
        <Link className="auth-brand" href="/">
          <span>
            <ShieldCheck size={21} />
          </span>{" "}
          Klaveroq
        </Link>
        <span className="auth-status-icon">
          {complete ? <CheckCircle2 size={24} /> : <KeyRound size={24} />}
        </span>
        <p className="eyebrow">Account recovery</p>
        <h1>{complete ? "Password updated" : "Choose a new password"}</h1>
        {complete ? (
          <>
            <p>Your other sessions were signed out. Use your new password to continue.</p>
            <Link className="primary-button" href="/login">
              Sign in
            </Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <label>
              New password
              <input
                required
                minLength={12}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label>
              Confirm new password
              <input
                required
                minLength={12}
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            {error && (
              <div className="form-errors" role="alert">
                {error}
              </div>
            )}
            <button className="primary-button" disabled={busy}>
              {busy ? "Updating..." : "Update password"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
