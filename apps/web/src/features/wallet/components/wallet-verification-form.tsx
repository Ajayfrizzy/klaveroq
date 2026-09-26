"use client";

import { Copy, KeyRound, WalletCards } from "lucide-react";
import { useState } from "react";

type Challenge = { id: string; message: string; nonce: string; expiresAt: string };

export function WalletVerificationForm({ initialMessage = "" }: { initialMessage?: string }) {
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState<"mainnet" | "testnet">("mainnet");
  const [purpose, setPurpose] = useState<"FUNDING" | "PAYOUT" | "BOTH">("BOTH");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [signature, setSignature] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function requestChallenge(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/wallets/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, network }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error?.message ?? "A signing challenge could not be created.");
      setChallenge(body.data);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "A signing challenge could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/wallets/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.id,
          nonce: challenge.nonce,
          signature,
          publicKey,
          purpose,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error?.message ?? "Wallet ownership could not be verified.");
      window.location.assign(
        body.securityHold ? "/wallet?walletStatus=hold" : "/wallet?walletStatus=verified",
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Wallet ownership could not be verified.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel wallet-connect-panel">
      <div className="section-heading">
        <div>
          <h2>Verify a CKB wallet</h2>
          <p>Prove ownership by signing a one-time message</p>
        </div>
        <WalletCards size={20} />
      </div>
      {!challenge ? (
        <form className="wallet-connect-form" onSubmit={requestChallenge}>
          <label>
            Network
            <select
              value={network}
              onChange={(event) => setNetwork(event.target.value as "mainnet" | "testnet")}
            >
              <option value="mainnet">CKB mainnet</option>
              <option value="testnet">CKB testnet</option>
            </select>
          </label>
          <label>
            Purpose
            <select
              value={purpose}
              onChange={(event) => setPurpose(event.target.value as typeof purpose)}
            >
              <option value="BOTH">Funding and payout</option>
              <option value="FUNDING">Funding</option>
              <option value="PAYOUT">Payout</option>
            </select>
          </label>
          <label className="full-field">
            Wallet address
            <input
              required
              minLength={20}
              maxLength={300}
              value={address}
              onChange={(event) => setAddress(event.target.value.trim())}
              placeholder="ckb..."
            />
          </label>
          <button className="primary-button" disabled={busy}>
            <KeyRound size={16} /> {busy ? "Creating..." : "Create signing message"}
          </button>
        </form>
      ) : (
        <form className="wallet-sign-form" onSubmit={verify}>
          <label>
            Message to sign
            <textarea readOnly rows={8} value={challenge.message} />
          </label>
          <button
            className="secondary-button copy-message"
            type="button"
            onClick={() => navigator.clipboard.writeText(challenge.message)}
          >
            <Copy size={15} /> Copy message
          </button>
          <p className="form-feedback">
            Sign this exact message in your CKB wallet. It expires{" "}
            {new Date(challenge.expiresAt).toLocaleString()} and does not authorize a payment.
          </p>
          <label>
            Signature
            <input
              required
              minLength={20}
              value={signature}
              onChange={(event) => setSignature(event.target.value.trim())}
            />
          </label>
          <label>
            Public key
            <input
              required
              minLength={20}
              value={publicKey}
              onChange={(event) => setPublicKey(event.target.value.trim())}
            />
          </label>
          <div className="wallet-form-actions">
            <button className="secondary-button" type="button" onClick={() => setChallenge(null)}>
              Cancel
            </button>
            <button className="primary-button" disabled={busy}>
              {busy ? "Verifying..." : "Verify ownership"}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="form-feedback error" role="alert">
          {error}
        </p>
      )}
      {initialMessage && (
        <p className="form-feedback success" role="status">
          {initialMessage}
        </p>
      )}
    </section>
  );
}
