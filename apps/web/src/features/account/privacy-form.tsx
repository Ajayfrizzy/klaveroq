"use client";
import { useState } from "react";
export function PrivacyForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await fetch("/api/account/privacy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, message }),
          });
          const b = await r.json();
          if (!r.ok) throw new Error(b.error?.message ?? "Please retry.");
          setFeedback(
            `Request recorded. Reference: ${b.data.reference}. Support will review your request and may need to verify your identity before making changes.`,
          );
          setMessage("");
        } catch (e) {
          setFeedback(e instanceof Error ? e.message : "Please retry.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Contact email
        <input
          required
          type="email"
          maxLength={320}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        How can we help?
        <textarea
          required
          minLength={10}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      <button className="primary-button" disabled={busy}>
        {busy ? "Sending..." : "Submit privacy request"}
      </button>
      {feedback && (
        <p role="status" className="account-reference">
          {feedback}
        </p>
      )}
    </form>
  );
}
