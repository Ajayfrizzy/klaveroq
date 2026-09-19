"use client";

import { Headphones, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("support@klaveroq.local");
  const [password, setPassword] = useState("KlaveroqDemo!2026");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error?.message ?? "Authentication failed.");
      setBusy(false);
      return;
    }
    if (!["SUPPORT", "SUPER_ADMIN"].includes(body.data?.user?.systemRole)) {
      setError(
        "This account does not have administration access. Sign in with a support administrator account.",
      );
      setBusy(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }
  return (
    <main className="admin-login-page">
      <section className="admin-login-brand">
        <div>
          <span>
            <ShieldCheck size={25} />
          </span>
          <strong>Klaveroq</strong>
          <small>Operations console</small>
        </div>
        <h1>Support administration</h1>
        <p>Review customer cases, coordinate responses, and resolve operational issues.</p>
        <ul>
          <li>
            <Headphones size={16} /> Dedicated support queue
          </li>
          <li>
            <ShieldCheck size={16} /> Restricted administrator access
          </li>
        </ul>
      </section>
      <section className="admin-login-panel">
        <form onSubmit={submit}>
          <p className="eyebrow">Administration</p>
          <h2>Sign in to operations</h2>
          <p>Use an authorized support or super administrator account.</p>
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
              autoComplete="current-password"
              minLength={12}
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
            {busy ? "Signing in..." : "Open admin console"}
          </button>
          <Link href="/login">Return to customer sign in</Link>
        </form>
      </section>
    </main>
  );
}
