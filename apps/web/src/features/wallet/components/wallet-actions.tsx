"use client";

import { Landmark, Send, Trash2 } from "lucide-react";
import { useState } from "react";

export function WalletActions({
  wallet,
}: {
  wallet: {
    id: string;
    status: string;
    purpose: string;
    isDefaultFunding: boolean;
    isDefaultPayout: boolean;
  };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function update(method: "PATCH" | "DELETE", defaultFor?: "FUNDING" | "PAYOUT") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/wallets/${wallet.id}`, {
        method,
        headers: defaultFor ? { "Content-Type": "application/json" } : undefined,
        body: defaultFor ? JSON.stringify({ defaultFor }) : undefined,
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error?.message ?? "The wallet could not be updated.");
      }
      window.dispatchEvent(new Event("notifications:changed"));
      window.location.assign(
        method === "DELETE" ? "/wallet?walletStatus=removed" : "/wallet?walletStatus=updated",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The wallet could not be updated.");
    } finally {
      setBusy(false);
    }
  }
  if (wallet.status === "REVOKED" || wallet.status === "REPLACED") return null;
  return (
    <>
      <div className="wallet-actions">
        {["FUNDING", "BOTH"].includes(wallet.purpose) && !wallet.isDefaultFunding && (
          <button
            disabled={busy || wallet.status !== "VERIFIED"}
            onClick={() => update("PATCH", "FUNDING")}
          >
            <Landmark size={14} /> Set for funding
          </button>
        )}
        {["PAYOUT", "BOTH"].includes(wallet.purpose) && !wallet.isDefaultPayout && (
          <button
            disabled={busy || wallet.status !== "VERIFIED"}
            onClick={() => update("PATCH", "PAYOUT")}
          >
            <Send size={14} /> Set for payout
          </button>
        )}
        <button
          className="danger-text"
          disabled={busy}
          onClick={() => update("DELETE")}
          aria-label="Remove wallet"
        >
          <Trash2 size={14} /> Remove
        </button>
      </div>
      {error && (
        <p className="form-feedback error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
