"use client";

import { safeReturnTo } from "@/server/auth/google";
import { CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type State = "idle" | "verifying" | "verified" | "error";

export function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const [destination, setDestination] = useState(safeReturnTo(searchParams.get("returnTo")));
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchParams.get("returnTo")) return;
      try {
        setDestination(safeReturnTo(sessionStorage.getItem("klaveroq:auth-return")));
      } catch {
        /* Storage is optional. */
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [searchParams]);
  const token = searchParams.get("token");
  const [localToken, setLocalToken] = useState(searchParams.get("localToken"));
  const recipient = searchParams.get("email");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [state, setState] = useState<State>(
    token ? "verifying" : searchParams.get("sent") === "0" ? "error" : "idle",
  );
  const [message, setMessage] = useState(
    searchParams.get("sent") === "0"
      ? "Your account was created, but the email could not be sent. Try again below."
      : searchParams.get("sent") === "1"
        ? "A verification link has been sent. Open the link in your email to verify your account."
        : "Open the verification link in your email, or request a new link below.",
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
        body: JSON.stringify({ email, returnTo: destination }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "The email could not be sent.");
      setLocalToken(body.data?.verificationToken ?? null);
      if (body.data?.emailSent === false) {
        setState("error");
        setMessage("The verification email could not be sent. Please try again.");
      } else {
        setMessage(
          body.data?.emailSent === true
            ? "A new verification link has been sent. Open the link in your email to verify your account."
            : "Request received. If this address has an unverified account, check its inbox and spam folder for a verification link.",
        );
      }
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
        <h1>
          {state === "verified"
            ? "Email verified"
            : !token && recipient
              ? "Check your email"
              : "Verify your email"}
        </h1>
        <p className={state === "error" ? "form-feedback error" : "form-feedback"} role="status">
          {state === "verifying" ? "Verifying your link..." : message}
        </p>
        {state === "verified" ? (
          <Link className="primary-button" href={destination === "/" ? "/dashboard" : destination}>
            Continue to Klaveroq
          </Link>
        ) : (
          <>
            {localToken && !token && (
              <Link
                className="secondary-button"
                href={`/verify-email?token=${localToken}&returnTo=${encodeURIComponent(destination)}`}
              >
                Open local verification link
              </Link>
            )}
            {recipient && <p className="auth-recipient">{recipient}</p>}
            <p>Can’t find the email? Check your spam folder.</p>
            <form onSubmit={resend}>
              {!recipient && (
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
              )}
              <button className="secondary-button" disabled={busy || state === "verifying"}>
                {busy
                  ? "Sending..."
                  : state === "error"
                    ? "Retry verification email"
                    : "Resend verification email"}
              </button>
            </form>
            <small>
              Already verified?{" "}
              <Link href={`/login?returnTo=${encodeURIComponent(destination)}`}>Sign in</Link>
            </small>
          </>
        )}
      </section>
    </main>
  );
}
