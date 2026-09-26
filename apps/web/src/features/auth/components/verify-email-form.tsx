"use client";

import { CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type State = "idle" | "verifying" | "verified" | "error";

export function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const localToken = searchParams.get("localToken");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [state, setState] = useState<State>(token ? "verifying" : "idle");
  const [message, setMessage] = useState(
    searchParams.get("sent") === "0"
      ? "Your account was created, but the email could not be sent. Try again below."
      : "Check your inbox for a verification link.",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message ?? "Email verification failed.");
        if (active) {
          setState("verified");
          setMessage("Your email is verified. Your account is ready.");
        }
      })
      .catch((reason) => {
        if (active) {
          setState("error");
          setMessage(reason instanceof Error ? reason.message : "Email verification failed.");
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  const resend = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setState("idle");
    try {
      const response = await fetch("/api/auth/verify-email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "The email could not be sent.");
      setMessage("If that address has an unverified account, a new link has been sent.");
    } catch (reason) {
      setState("error");
      setMessage(reason instanceof Error ? reason.message : "The email could not be sent.");
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
          {state === "verified" ? <CheckCircle2 size={24} /> : <Mail size={24} />}
        </span>
        <p className="eyebrow">Account verification</p>
        <h1>{state === "verified" ? "Email verified" : "Verify your email"}</h1>
        <p className={state === "error" ? "form-feedback error" : "form-feedback"} role="status">
          {state === "verifying" ? "Verifying your link..." : message}
        </p>
        {state === "verified" ? (
          <Link className="primary-button" href="/">
            Continue to dashboard
          </Link>
        ) : (
          <>
            {localToken && !token && (
              <Link className="secondary-button" href={`/verify-email?token=${localToken}`}>
                Open local verification link
              </Link>
            )}
            <form onSubmit={resend}>
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
              <button className="primary-button" disabled={busy}>
                {busy ? "Sending..." : "Send a new link"}
              </button>
            </form>
            <small>
              Already verified? <Link href="/login">Sign in</Link>
            </small>
          </>
        )}
      </section>
    </main>
  );
}
