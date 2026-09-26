"use client";

import { Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [localToken, setLocalToken] = useState<string>();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setLocalToken(undefined);
    try {
      const response = await fetch("/api/auth/password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "The request could not be sent.");
      setMessage("If that address has an account, a password reset link has been sent.");
      setLocalToken(body.data?.resetToken);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "The request could not be sent.");
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
          <Mail size={24} />
        </span>
        <p className="eyebrow">Account recovery</p>
        <h1>Reset your password</h1>
        <p>Enter your account email. We will send a one-hour reset link if the account exists.</p>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {message && <p className="form-feedback">{message}</p>}
          {localToken && (
            <Link className="secondary-button" href={`/reset-password?token=${localToken}`}>
              Open local reset link
            </Link>
          )}
          <button className="primary-button" disabled={busy}>
            {busy ? "Sending..." : "Send reset link"}
          </button>
        </form>
        <small>
          Return to <Link href="/login">sign in</Link>
        </small>
      </section>
    </main>
  );
}
