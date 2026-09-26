import {
  AlertCircle,
  Check,
  Clock3,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import {
  identityVerifications,
  mfaMethods,
  securityHolds,
  sessions,
  wallets,
} from "@/server/db/schema";
import { SessionList } from "@/features/security/components/session-list";
import { MfaPanel } from "@/features/security/components/mfa-panel";
import { WalletActions } from "@/features/wallet/components/wallet-actions";
import { WalletVerificationForm } from "@/features/wallet/components/wallet-verification-form";

export const dynamic = "force-dynamic";

const label = (value: string) => value.toLowerCase().replaceAll("_", " ");

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ walletStatus?: string }>;
}) {
  const current = await getCurrentUser();
  if (!current) redirect("/login?returnTo=%2Fwallet");
  const { walletStatus } = await searchParams;

  const now = new Date();
  const [walletRecords, identityRows, sessionRecords, activeHolds, mfaRows] = await Promise.all([
    db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, current.user.id))
      .orderBy(desc(wallets.createdAt)),
    db
      .select()
      .from(identityVerifications)
      .where(eq(identityVerifications.userId, current.user.id))
      .orderBy(desc(identityVerifications.createdAt))
      .limit(1),
    db
      .select({
        id: sessions.id,
        userAgent: sessions.userAgent,
        lastSeenAt: sessions.lastSeenAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, current.user.id),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
        ),
      )
      .orderBy(desc(sessions.lastSeenAt))
      .limit(10),
    db
      .select()
      .from(securityHolds)
      .where(
        and(
          eq(securityHolds.userId, current.user.id),
          isNull(securityHolds.releasedAt),
          or(isNull(securityHolds.expiresAt), gt(securityHolds.expiresAt, now)),
        ),
      )
      .orderBy(desc(securityHolds.createdAt)),
    db
      .select({
        verifiedAt: mfaMethods.verifiedAt,
        recoveryCodeHashes: mfaMethods.recoveryCodeHashes,
      })
      .from(mfaMethods)
      .where(and(eq(mfaMethods.userId, current.user.id), isNull(mfaMethods.disabledAt)))
      .limit(1),
  ]);
  const identity = identityRows[0];
  const mfa = mfaRows[0];
  const verifiedWallets = walletRecords.filter((wallet) => wallet.status === "VERIFIED");

  return (
    <AppShell>
      <PageHeader
        eyebrow="Account records"
        title="Wallet & security"
        description="Review wallet, identity, and active-session records stored for your account."
        icon={WalletCards}
        action={
          <Link className="secondary-button" href="/identity">
            <ShieldCheck size={16} /> Manage identity
          </Link>
        }
      />
      <div className="security-layout">
        <div>
          <WalletVerificationForm
            initialMessage={
              walletStatus === "hold"
                ? "Ownership verified. The payout change is in a 24-hour security hold."
                : walletStatus === "verified"
                  ? "Wallet ownership verified."
                  : walletStatus === "removed"
                    ? "Wallet removed from active use."
                    : walletStatus === "updated"
                      ? "Default wallet selection updated."
                      : ""
            }
          />
          {walletRecords.length ? (
            walletRecords.map((wallet) => (
              <section className="panel wallet-card" key={wallet.id}>
                <div className="wallet-card-head">
                  <span>
                    <WalletCards size={21} />
                  </span>
                  <div>
                    <h2>{wallet.network.toUpperCase()} wallet</h2>
                    <p>{wallet.address}</p>
                  </div>
                  <span
                    className={wallet.status === "VERIFIED" ? "verified-chip" : "listing-status"}
                  >
                    {wallet.status === "VERIFIED" && <Check size={13} />} {label(wallet.status)}
                  </span>
                </div>
                <div className="wallet-purposes">
                  <div>
                    <span>Purpose</span>
                    <strong>{label(wallet.purpose)}</strong>
                  </div>
                  <div>
                    <span>Defaults</span>
                    <strong>
                      {[
                        wallet.isDefaultFunding ? "Funding" : null,
                        wallet.isDefaultPayout ? "Payout" : null,
                      ]
                        .filter(Boolean)
                        .join(" and ") || "None"}
                    </strong>
                  </div>
                  <div>
                    <span>{wallet.verifiedAt ? "Verified" : "Added"}</span>
                    <strong>{(wallet.verifiedAt ?? wallet.createdAt).toLocaleDateString()}</strong>
                  </div>
                </div>
                <p className="form-feedback">
                  This ownership record does not assert a blockchain balance or payment capability.
                </p>
                <WalletActions wallet={wallet} />
              </section>
            ))
          ) : (
            <section className="panel market-empty account-empty">
              <WalletCards size={26} />
              <h2>No wallet records</h2>
              <p>No payment destination has been stored for your account.</p>
            </section>
          )}

          <SessionList
            initialSessions={sessionRecords.map((session) => ({
              ...session,
              current: session.id === current.sessionId,
            }))}
          />
          <MfaPanel
            initialEnabled={Boolean(mfa?.verifiedAt)}
            recoveryCodesRemaining={mfa?.recoveryCodeHashes.length ?? 0}
            passwordConfigured={Boolean(current.user.passwordHash)}
          />
        </div>
        <aside>
          <section className="panel security-score">
            <ShieldCheck size={27} />
            <h2>Recorded account checks</h2>
            <p>These statuses come from your authorized account records.</p>
            <ul>
              <li>
                {current.user.emailVerifiedAt ? <Check size={14} /> : <Clock3 size={14} />}
                Email {current.user.emailVerifiedAt ? "verified" : "pending"}
              </li>
              <li>
                {identity?.status === "VERIFIED" ? <Check size={14} /> : <Clock3 size={14} />}
                <Link href="/identity">
                  Identity {identity ? label(identity.status) : "not started"}
                </Link>
              </li>
              <li>
                {verifiedWallets.length ? <Check size={14} /> : <Clock3 size={14} />}
                {verifiedWallets.length
                  ? `${verifiedWallets.length} verified wallet record${verifiedWallets.length === 1 ? "" : "s"}`
                  : "No verified wallet record"}
              </li>
              <li>
                <AlertCircle size={14} /> Payment protection unavailable
              </li>
            </ul>
          </section>

          {activeHolds.length > 0 && (
            <section className="panel security-settings">
              <h2>Active security holds</h2>
              {activeHolds.map((hold) => (
                <div key={hold.id}>
                  <LockKeyhole size={16} />
                  <span>
                    <strong>{label(hold.type)}</strong>
                    <small>
                      {hold.expiresAt
                        ? `Expires ${hold.expiresAt.toLocaleString()}`
                        : "No expiry recorded"}
                    </small>
                  </span>
                </div>
              ))}
            </section>
          )}

          <section className="panel security-settings">
            <h2>Account security</h2>
            <div>
              <LockKeyhole size={16} />
              <span>
                <strong>Password credential</strong>
                <small>{current.user.passwordHash ? "Configured" : "Not configured"}</small>
              </span>
            </div>
            <div>
              <Smartphone size={16} />
              <span>
                <strong>Two-factor authentication</strong>
                <small>{mfa?.verifiedAt ? "Enabled" : "Not enabled"}</small>
              </span>
            </div>
            <div>
              <Clock3 size={16} />
              <span>
                <strong>Active sessions</strong>
                <small>
                  {sessionRecords.length} recorded{" "}
                  {sessionRecords.length === 1 ? "session" : "sessions"}
                </small>
              </span>
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
