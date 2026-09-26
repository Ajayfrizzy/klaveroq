"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SandboxIdentityForm({ verificationId }: { verificationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"VERIFIED" | "REJECTED" | null>(null);
  const [error, setError] = useState("");
  async function complete(outcome: "VERIFIED" | "REJECTED") {
    setBusy(outcome);
    setError("");
    try {
      const response = await fetch("/api/identity/sandbox/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationId, outcome }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error?.message ?? "The sandbox check could not complete.");
      router.replace("/identity");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The sandbox check could not complete.");
      setBusy(null);
    }
  }
  return (
    <section className="panel identity-panel sandbox-panel">
      <p className="eyebrow">Local testing only</p>
      <h1>Identity provider sandbox</h1>
      <p>Choose the provider result to exercise the customer verification workflow.</p>
      <div className="sandbox-actions">
        <button
          className="primary-button"
          disabled={Boolean(busy)}
          onClick={() => complete("VERIFIED")}
        >
          <CheckCircle2 size={16} /> {busy === "VERIFIED" ? "Completing..." : "Return verified"}
        </button>
        <button
          className="secondary-button"
          disabled={Boolean(busy)}
          onClick={() => complete("REJECTED")}
        >
          <XCircle size={16} /> {busy === "REJECTED" ? "Completing..." : "Return rejected"}
        </button>
      </div>
      {error && (
        <p className="form-feedback error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
