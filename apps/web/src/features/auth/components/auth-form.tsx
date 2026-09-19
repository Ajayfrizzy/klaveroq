"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState(mode === "login" ? "client@klaveroq.local" : "");
  const [password, setPassword] = useState(mode === "login" ? "KlaveroqDemo!2026" : "");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "register" ? { email, password, displayName } : { email, password },
        ),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Authentication failed.");
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      router.push(
        returnTo?.startsWith("/") && !returnTo.startsWith("//")
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
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="auth-brand" href="/">
          <span>
            <ShieldCheck size={21} />
          </span>{" "}
          Klaveroq
        </Link>
        <p className="eyebrow">Protected work payments</p>
        <h1>{mode === "login" ? "Sign in" : "Create account"}</h1>
        <p>
          {mode === "login"
            ? "Access your agreements, milestones, and payment records."
            : "Create an account before funding or accepting protected work."}
        </p>
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
          {error && (
            <div className="form-errors" role="alert">
              {error}
            </div>
          )}
          <button className="primary-button" disabled={busy}>
            {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <small>
          {mode === "login" ? (
            <>
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
