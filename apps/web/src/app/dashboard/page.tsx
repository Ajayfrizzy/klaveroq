import { SectionUnavailable } from "@/components/ui/section-unavailable";
import { ArrowRight, Check, Clock3, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCurrentUser } from "@/server/auth/session";
import { getDashboardData } from "@/features/dashboard/server/queries";
import { formatAssetAmount } from "@/features/dashboard/server/metrics";
import { IntentPanel } from "@/features/dashboard/intent-panel";
import { getMissingPublicationFields } from "@/features/talent/server/publication";
import { formatEventTime } from "@/features/activity/presentation";
import { identityConfiguration } from "@/server/identity/config";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login?returnTo=/dashboard");
  const data = await getDashboardData(current.user.id, Boolean(current.user.emailVerifiedAt));
  const displayName = current.profile?.displayName?.split(" ")[0] || "there";
  const profileComplete = Boolean(
    current.profile && getMissingPublicationFields(current.profile).length === 0,
  );
  const verificationUnavailable =
    data.verification.identity === null || data.verification.wallet === null;
  const allChecksRecorded = Object.values(data.verification).every(Boolean);
  const betaIdentityDisabled = identityConfiguration().betaDisabled;

  return (
    <AppShell>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Work with trust. Deliver with proof.</p>
          <h1>Welcome{displayName === "there" ? "" : `, ${displayName}`}</h1>
          <p>Here is what needs your attention across your jobs.</p>
        </div>
      </div>

      <IntentPanel
        userId={current.user.id}
        profileReady={profileComplete}
        hasHistory={data.activeJobCount > 0}
        published={Boolean(current.profile?.isPublic)}
      />

      <section className="metrics-grid" aria-label="Account summary">
        <Metric
          icon={<BriefIcon />}
          tone="teal"
          label="Active jobs"
          value={String(data.activeJobCount)}
          note="Across client and worker roles"
        />
        <Metric
          icon={<Clock3 size={20} />}
          tone="amber"
          label="Pending actions"
          value={String(data.pendingActionCount)}
          note={data.pendingActionCount ? "Items waiting on you" : "Nothing waiting on you"}
        />
      </section>

      <div className="dashboard-grid">
        <section className="panel jobs-panel">
          <div className="section-heading">
            <div>
              <h2>Active jobs</h2>
              <p>Your current marketplace work</p>
            </div>
            <Link href="/jobs?view=agreements">
              View all <ArrowRight size={15} />
            </Link>
          </div>
          {data.jobs.length > 0 && (
            <div className="job-column-head" aria-hidden="true">
              <span>Job</span>
              <span>Status</span>
              <span>Value</span>
              <span>Next action</span>
              <span />
            </div>
          )}
          <div className="job-list">
            {data.jobs.length ? (
              data.jobs.slice(0, 5).map((job) => (
                <Link className="job-row" href={`/jobs/${job.id}`} key={job.id}>
                  <div className="job-title">
                    <span className={`role-mark ${job.role.toLowerCase()}`}>{job.role[0]}</span>
                    <div>
                      <strong>{job.title}</strong>
                      <span>
                        {job.counterparty} · {job.reference}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={job.status} />
                  <div className="job-value">
                    <strong>
                      {formatAssetAmount(job.amount, job.assetDecimals)} {job.asset}
                    </strong>
                    <span>{job.progress} milestones</span>
                  </div>
                  <div className="job-next">
                    <strong>{job.nextAction}</strong>
                    <span>Updated {job.updatedAt.toLocaleDateString()}</span>
                  </div>
                  <ArrowRight className="row-arrow" size={18} />
                </Link>
              ))
            ) : (
              <div className="market-empty compact-empty">
                <p>No active jobs yet. Start with an opportunity or a brief.</p>
                <div className="empty-actions">
                  <Link className="secondary-button" href="/discover">
                    Find work
                  </Link>
                  <Link className="secondary-button" href="/jobs/new/public">
                    Post a job
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="panel actions-panel">
          <div className="section-heading">
            <div>
              <h2>Pending actions</h2>
              <p>Items waiting on you</p>
            </div>
            <span className="count-badge">{data.pendingActionCount}</span>
          </div>
          {data.pendingActions.length ? (
            data.pendingActions.map((action) => (
              <div className="action-item" key={action.id}>
                <span className="action-icon">
                  <Clock3 size={18} />
                </span>
                <div>
                  <strong>{action.title}</strong>
                  <p>{action.detail}</p>
                  <small>{action.note}</small>
                  <Link href={`/jobs/${action.jobId}`}>
                    Open job <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="market-empty compact-empty">
              <p>No pending actions.</p>
            </div>
          )}
        </aside>
      </div>

      {verificationUnavailable ? (
        <section className="panel" aria-label="Account verification">
          <SectionUnavailable label="Verification status" />
        </section>
      ) : (
        <section className="readiness-strip" aria-labelledby="readiness-title">
          <div className="readiness-icon">
            <ShieldCheck size={23} />
          </div>
          <div className="readiness-copy">
            <div>
              <h2 id="readiness-title">
                {betaIdentityDisabled
                  ? "Account security"
                  : allChecksRecorded
                    ? "Account verification complete"
                    : "Finish account verification"}
              </h2>
              {allChecksRecorded && (
                <span className="verified-label">
                  <Check size={13} /> Verified
                </span>
              )}
            </div>
            <p>
              {allChecksRecorded
                ? "Email, identity, and wallet ownership are verified."
                : betaIdentityDisabled
                  ? "Review your email and sign-in security. Wallet ownership is optional during community beta."
                  : "Review your email, identity, and wallet verification."}
            </p>
          </div>
          <div className="readiness-items">
            <span>
              {data.verification.email && <Check size={15} />} Email{" "}
              {data.verification.email ? "verified" : "pending"}
            </span>
            <span>
              {data.verification.identity && <Check size={15} />} Identity{" "}
              {data.verification.identity
                ? "verified"
                : betaIdentityDisabled
                  ? "not required during beta"
                  : "pending"}
            </span>
            <span>
              {data.verification.wallet && <Check size={15} />} Wallet{" "}
              {data.verification.wallet
                ? "verified"
                : betaIdentityDisabled
                  ? "optional"
                  : "pending"}
            </span>
          </div>
          <Link href="/wallet">
            Manage security <ArrowRight size={15} />
          </Link>
        </section>
      )}

      <section className="activity-panel">
        <div className="section-heading">
          <div>
            <h2>Recent activity</h2>
            <p>Updates across your workspace</p>
          </div>
          <Link href="/activity">
            Full activity <ArrowRight size={15} />
          </Link>
        </div>
        <div className="activity-list">
          {data.activity === null ? (
            <SectionUnavailable label="Recent activity" />
          ) : data.activity.length ? (
            data.activity.slice(0, 5).map((item) => (
              <div className="activity-row" key={item.id}>
                <span className="activity-dot blue" />
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
                <time dateTime={item.createdAt.toISOString()}>
                  {formatEventTime(item.createdAt)}
                </time>
              </div>
            ))
          ) : (
            <div className="market-empty compact-empty">
              <p>No activity recorded yet.</p>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function Metric({
  icon,
  tone,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article>
      <span className={`metric-icon ${tone}`}>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function BriefIcon() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
    </svg>
  );
}
