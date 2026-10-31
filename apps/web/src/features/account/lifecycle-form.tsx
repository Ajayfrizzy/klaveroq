"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function LifecycleForm({
  mode,
  initialEmail = "",
  hasPassword = true,
  profileMissing = false,
}: {
  mode: "delete" | "recover";
  initialEmail?: string;
  hasPassword?: boolean;
  profileMissing?: boolean;
}) {
  const params = useSearchParams();
  const [email, setEmail] = useState(initialEmail || params.get("email") || "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [complete, setComplete] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [emailMode, setEmailMode] = useState(!hasPassword || Boolean(params.get("token")));
  const token = params.get("token") ?? undefined;
  const action = mode === "delete" ? "DELETE" : "RECOVER";
  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account/confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action: mode }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error?.message ?? "The request could not be completed.");
      setNotice(
        "Request received. If this is an eligible Google account, check your inbox and spam folder for a confirmation link. No change happens until you explicitly confirm on that page. You can retry if no email arrives.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        mode === "delete" ? "/api/account/closure" : "/api/account/recover",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password: emailMode ? undefined : password,
            token,
            code,
            confirmation,
          }),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error?.message ?? "The request could not be completed.");
      setDeadline(body.data.processAfter ?? "");
      setComplete(true);
      setPassword("");
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  if (complete)
    return (
      <section className="auth-panel auth-status-panel">
        <h1>{mode === "delete" ? "Account deletion scheduled" : "Account recovered"}</h1>
        <p role="status">
          {mode === "delete"
            ? `Your profile is hidden and your sessions are signed out. Recover before ${new Date(deadline).toUTCString()} to cancel deletion. Necessary shared, financial and security records may be retained.`
            : "Your deletion request was cancelled. Sign in again to continue. Previously closed listings and revoked invitations remain closed."}
        </p>
        <Link className="secondary-button" href={mode === "delete" ? "/account/recover" : "/login"}>
          {mode === "delete" ? "Recover account" : "Sign in"}
        </Link>
        <Link href="/account/privacy">Privacy or support request</Link>
      </section>
    );
  return (
    <section className="auth-panel auth-status-panel account-lifecycle">
      <Link className="auth-brand" href="/">
        Klaveroq
      </Link>
      <h1>{mode === "delete" ? "Delete account" : "Recover account"}</h1>
      {profileMissing && (
        <div role="status">
          <p>
            Your sign-in works, but your profile is missing. You can create a new private profile
            without changing your account.
          </p>
          <RepairProfile />
        </div>
      )}
      {mode === "delete" ? (
        <>
          <p>
            Your profile will be hidden immediately and all sessions signed out. You will have 30
            days to explicitly recover your account. Logging in alone does not cancel deletion.
          </p>
          <p>
            After 30 days, eligible personal data is removed. Necessary agreements, payment history,
            shared records and security evidence may be retained for authorized review. Active
            agreements, unsettled payments, disputes or holds must be resolved first.
          </p>
        </>
      ) : (
        <p>
          Explicitly cancel your deletion request within 30 days. Confirm your sign-in details and
          two-factor code if enabled. Recovery does not reopen cancelled invitations or closed
          listings.
        </p>
      )}
      <form onSubmit={submit}>
        <label>
          Email
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            readOnly={Boolean(initialEmail)}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {emailMode ? (
          <>
            <p>
              For Google accounts without a password, use an email confirmation link. Two-factor
              verification is still required when enabled.
            </p>
            {!token && (
              <button type="button" className="secondary-button" disabled={busy} onClick={send}>
                Send confirmation email
              </button>
            )}
            {token && <p>Confirmation link opened. Review the consequences and confirm below.</p>}
          </>
        ) : (
          <label>
            Current password
            <input
              required
              type="password"
              maxLength={128}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {mode === "recover" && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => setEmailMode((v) => !v)}
          >
            {emailMode ? "Use password" : "Use email confirmation for Google"}
          </button>
        )}
        <label>
          Two-factor or recovery code (if enabled)
          <input
            autoComplete="one-time-code"
            maxLength={40}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <label>
          Type {action} to confirm
          <input
            required
            pattern={action}
            autoComplete="off"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
        {error && (
          <p className="form-feedback error" role="alert">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        <button className="primary-button" disabled={busy || (emailMode && !token)}>
          {busy
            ? "Please wait..."
            : mode === "delete"
              ? "Confirm deletion request"
              : "Cancel deletion and recover"}
        </button>
      </form>
      <Link href="/account/privacy">Need earlier privacy handling, an exception or help?</Link>
      <Link href={mode === "delete" ? "/wallet" : "/login"}>Back</Link>
    </section>
  );
}
function RepairProfile() {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          const r = await fetch("/api/account/repair-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ displayName: name }),
          });
          if (!r.ok) throw new Error("Your profile could not be restored. Please retry.");
          window.location.assign("/profile");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Please retry.");
        }
      }}
    >
      <label>
        New display name
        <input
          required
          minLength={2}
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button className="secondary-button">Create private profile</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
