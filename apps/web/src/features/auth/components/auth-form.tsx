"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { GOOGLE_OAUTH_MESSAGES, googleOAuthHref, safeReturnTo } from "@/server/auth/google";
import { initialAuthCredentials } from "@/features/auth/defaults";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaults = initialAuthCredentials();
  const [email, setEmail] = useState(defaults.email);
  const [password, setPassword] = useState(defaults.password);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [mfaToken, setMfaToken] = useState(searchParams.get("mfaToken") ?? "");
  const [mfaCode, setMfaCode] = useState("");
  const oauthError = searchParams.get("oauthError");
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const googleHref = googleOAuthHref(returnTo);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "register" ? { email, password, displayName } : { email, password, returnTo },
        ),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Authentication failed.");
      if (mode === "register") {
        const params = new URLSearchParams({ email });
        params.set("sent", body.data?.emailSent ? "1" : "0");
        if (body.data?.verificationToken) params.set("localToken", body.data.verificationToken);
        router.push(`/verify-email?${params.toString()}`);
        router.refresh();
        return;
      }
      if (body.data?.mfaRequired) {
        setMfaToken(body.data.mfaToken);
        return;
      }
      router.push(
        returnTo !== "/"
          ? returnTo
          : ["SUPPORT", "SUPER_ADMIN"].includes(body.data?.user?.systemRole)
            ? "/admin"
            : "/",
      );
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };
  const completeMfa = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/mfa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: mfaToken, code: mfaCode }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Two-factor authentication failed.");
      const destination =
        body.data?.returnTo && body.data.returnTo !== "/"
          ? body.data.returnTo
          : ["SUPPORT", "SUPER_ADMIN"].includes(body.data?.user?.systemRole)
            ? "/admin"
            : "/";
      router.push(destination);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Two-factor authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  if (mode === "login" && mfaToken)
    return (
      <main className="auth-page">
        <section className="auth-panel auth-status-panel">
          <Link className="auth-brand" href="/">
            <span>
              <ShieldCheck size={21} />
            </span>{" "}
            Klaveroq
          </Link>
          <p className="eyebrow">Account security</p>
          <h1>Two-factor authentication</h1>
          <p>Enter the six-digit code from your authenticator app or one unused recovery code.</p>
          <form onSubmit={completeMfa}>
            <label>
              Authentication code
              <input
                required
                autoComplete="one-time-code"
                minLength={6}
                maxLength={40}
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value)}
              />
            </label>
            {error && (
              <div className="form-errors" role="alert">
                {error}
              </div>
            )}
            <button className="primary-button" disabled={busy}>
              {busy ? "Verifying..." : "Verify and sign in"}
            </button>
          </form>
          <button
            className="secondary-button"
            onClick={() => {
              setMfaToken("");
              setMfaCode("");
              setError("");
            }}
          >
            Back to sign in
          </button>
        </section>
      </main>
    );
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="auth-brand" href="/">
          <span>
            <ShieldCheck size={21} />
          </span>{" "}
          Klaveroq
        </Link>
        <p className="eyebrow">Professional marketplace</p>
        <h1>{mode === "login" ? "Sign in" : "Create account"}</h1>
        <p>
          {mode === "login"
            ? "Access your agreements, milestones, and available payment records."
            : "Create an account to publish work, submit proposals, and manage agreements."}
        </p>
        <a
          className={`google-auth-button${googleBusy ? " disabled" : ""}`}
          href={googleHref}
          aria-disabled={googleBusy}
          onClick={(event) => {
            if (googleBusy) event.preventDefault();
            else setGoogleBusy(true);
          }}
        >
          <GoogleIcon />
          {googleBusy ? "Opening Google..." : "Continue with Google"}
        </a>
        <div className="auth-separator">
          <span>or continue with email</span>
        </div>
        <form onSubmit={submit}>
          {mode === "register" && (
            <label>
              Display name
              <input
                required
                minLength={2}
                maxLength={100}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
          )}
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
          <label>
            Password
            <input
              required
              type="password"
              minLength={12}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {(error || oauthError) && (
            <div className="form-errors" role="alert">
              {error ||
                GOOGLE_OAUTH_MESSAGES[oauthError ?? ""] ||
                GOOGLE_OAUTH_MESSAGES.OAUTH_FAILED}
            </div>
          )}
          <button className="primary-button" disabled={busy}>
            {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <small>
          {mode === "login" ? (
            <>
              <Link href="/forgot-password">Forgot password?</Link>
              <span className="auth-link-separator" aria-hidden="true">
                ·
              </span>
              Need an account? <Link href="/register">Register</Link>
            </>
          ) : (
            <>
              Already registered? <Link href="/login">Sign in</Link>
            </>
          )}
        </small>
      </section>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.89h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.24c1.9-1.75 2.98-4.33 2.98-7.37Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.4l-3.24-2.52c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.6A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.91A6 6 0 0 1 6.08 12c0-.66.11-1.31.31-1.91v-2.6H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.51l3.35-2.6Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.96c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.49l3.35 2.6C7.18 7.72 9.39 5.96 12 5.96Z"
      />
    </svg>
  );
}
