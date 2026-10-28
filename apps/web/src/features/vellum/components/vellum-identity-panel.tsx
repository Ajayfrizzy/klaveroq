"use client";

import { CheckCircle2, ExternalLink, Fingerprint, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isCurrentVellumIdentitySelection,
  type VellumIdentityBindingDto,
  type VellumIdentityOption,
} from "@/features/vellum/identity-binding";

function identityLabel(identity: Pick<VellumIdentityOption, "did" | "displayName">): string {
  return identity.displayName ? `${identity.displayName} - ${identity.did}` : identity.did;
}

export function VellumIdentityPanel({
  binding,
  hasVerifiedTestnetWallet,
}: {
  binding: VellumIdentityBindingDto | null;
  hasVerifiedTestnetWallet: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(binding);
  const [identities, setIdentities] = useState<VellumIdentityOption[]>([]);
  const [selectedDid, setSelectedDid] = useState(binding?.did ?? "");
  const [loading, setLoading] = useState(hasVerifiedTestnetWallet);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!hasVerifiedTestnetWallet) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/vellum/identity", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error?.message ?? "Vellum identities could not be loaded.");
      }
      const options = body.data as VellumIdentityOption[];
      setIdentities(options);
      setSelectedDid((selection) =>
        options.some((identity) => identity.did === selection)
          ? selection
          : (options[0]?.did ?? ""),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Vellum identities could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [hasVerifiedTestnetWallet]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selected = useMemo(
    () => identities.find((identity) => identity.did === selectedDid),
    [identities, selectedDid],
  );
  const selectionIsCurrent = isCurrentVellumIdentitySelection(current, selected);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/vellum/identity", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ did: selected.did, walletId: selected.walletId }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error?.message ?? "The Vellum identity could not be linked.");
      }
      setCurrent(body.data);
      setMessage("Preferred Vellum identity updated.");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The Vellum identity could not be linked.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel identity-panel vellum-identity-panel">
      <div className="identity-panel-heading">
        <span>
          <Fingerprint size={21} />
        </span>
        <div>
          <p className="eyebrow">Portable identity</p>
          <h2>Vellum DID</h2>
          <p>The linked identity receives evidence for future settled Klaveroq milestones.</p>
        </div>
      </div>

      {current && (
        <div className="vellum-identity-record">
          <CheckCircle2 size={18} />
          <span>
            <strong>{current.displayName || "Linked Vellum identity"}</strong>
            <small>{current.did}</small>
          </span>
          <a
            aria-label="Open Vellum public profile"
            href={`https://usevellum.xyz/profile/${encodeURIComponent(current.did)}`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} />
          </a>
        </div>
      )}

      {!hasVerifiedTestnetWallet ? (
        <div className="vellum-identity-empty">
          <p>Verify a CKB Testnet wallet before linking a Vellum identity.</p>
          <Link className="secondary-button" href="/wallet">
            Manage wallets
          </Link>
        </div>
      ) : loading ? (
        <p className="form-feedback" role="status">
          Loading Vellum identities...
        </p>
      ) : identities.length === 0 && !error ? (
        <div className="vellum-identity-empty">
          <p>No active Vellum DID is controlled by your verified Testnet wallet.</p>
          <a
            className="secondary-button"
            href="https://dashboard.usevellum.xyz/identity"
            target="_blank"
            rel="noreferrer"
          >
            Create a Vellum DID <ExternalLink size={15} />
          </a>
          <button className="secondary-button" type="button" onClick={() => void load()}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      ) : identities.length > 0 ? (
        <form className="vellum-identity-form" onSubmit={save}>
          <label>
            Preferred identity
            <select value={selectedDid} onChange={(event) => setSelectedDid(event.target.value)}>
              {identities.map((identity) => (
                <option key={identity.did} value={identity.did}>
                  {identityLabel(identity)}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <div className="vellum-selected-identity">
              <strong>{selected.displayName || "Vellum identity"}</strong>
              <small>{selected.did}</small>
            </div>
          )}
          <div className="vellum-identity-actions">
            <button className="secondary-button" type="button" onClick={() => void load()}>
              <RefreshCw size={15} /> Refresh
            </button>
            <button className="primary-button" disabled={saving || !selected || selectionIsCurrent}>
              {saving
                ? "Saving..."
                : !current
                  ? "Link identity"
                  : current.did === selected?.did
                    ? "Update identity"
                    : "Change identity"}
            </button>
          </div>
        </form>
      ) : null}

      {error && (
        <p className="form-feedback error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-feedback success" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
