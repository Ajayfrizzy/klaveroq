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

  const communityBeta = identityConfiguration().stage === "community_beta";
  const defaultNetwork = "testnet" as const;
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
  const identityVerified =
    identity?.status === "VERIFIED" && trustedIdentityProviders().includes(identity.provider);
  const mfa = mfaRows[0];
  const verifiedWallets = walletRecords.filter((wallet) => wallet.status === "VERIFIED");

  return (
    <AppShell>
      <PageHeader
        eyebrow="Account records"
        title="Wallet & security"
        description="Manage account security, sign-in sessions, and optional ownership records."
        icon={ShieldCheck}
        action={
          <Link className="secondary-button" href="/identity">
            <ShieldCheck size={16} /> Manage identity
          </Link>
        }
      />
      <section className="panel security-score">
        <ShieldCheck size={27} />
        <h2>Account security</h2>
        <p>
          Email or Google sign-in is your primary account access. Review your recorded security
          checks below.
        </p>
        <ul>
          <li>
            {current.user.emailVerifiedAt ? <Check size={14} /> : <Clock3 size={14} />}
            Email {current.user.emailVerifiedAt ? "verified" : "pending"}
          </li>
          <li>
            {identityVerified ? <Check size={14} /> : <Clock3 size={14} />}
            <Link href="/identity">
              Identity{" "}
              {identityVerified
                ? "verified"
                : identityConfiguration().betaDisabled
                  ? "not required during beta"
                  : identity?.status === "VERIFIED"
                    ? "not verified"
                    : identity
                      ? label(identity.status)
                      : "not started"}
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
      <div className="security-layout">
        <div>
          <MfaPanel
            initialEnabled={Boolean(mfa?.verifiedAt)}
            recoveryCodesRemaining={mfa?.recoveryCodeHashes.length ?? 0}
            passwordConfigured={Boolean(current.user.passwordHash)}
          />
          <SessionList
            initialSessions={sessionRecords.map((session) => ({
              ...session,
              current: session.id === current.sessionId,
            }))}
          />
          <section className="panel security-settings">
            <h2>Identity</h2>
            <p>
              {identityConfiguration().betaDisabled
                ? "Identity verification is not required during beta."
                : identityVerified
                  ? "Identity verified."
                  : "Review your identity verification status."}
            </p>
            <Link className="secondary-button" href="/identity">
              Manage identity
            </Link>
          </section>
          <WalletVerificationForm
            defaultNetwork={defaultNetwork}
            communityBeta={communityBeta}
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
                    <span>{communityBeta ? "Future intended use" : "Purpose"}</span>
                    <strong>{label(wallet.purpose)}</strong>
                  </div>
                  <div>
                    <span>{communityBeta ? "Future defaults" : "Defaults"}</span>
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
                <WalletActions wallet={wallet} communityBeta={communityBeta} />
              </section>
            ))
          ) : (
            <section className="panel market-empty account-empty">
              <WalletCards size={26} />
              <h2>No wallet records</h2>
              <p>You have not recorded wallet ownership. You can use the marketplace without it.</p>
            </section>
          )}
        </div>
        <aside>
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
            <h2>Sign-in security</h2>
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
import { identityConfiguration } from "@/server/identity/config";
import { trustedIdentityProviders } from "@/server/identity/provider";
