import {
  ArrowRight,
  Check,
  CircleDollarSign,
  Clock3,
  Compass,
  Plus,
  ShieldCheck,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCurrentUser } from "@/server/auth/session";
import { getDashboardData } from "@/features/dashboard/server/queries";
import { formatAssetAmount, presentAssetTotals } from "@/features/dashboard/server/metrics";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  const data = await getDashboardData(current.user.id, Boolean(current.user.emailVerifiedAt));
  const displayName = current.profile?.displayName?.split(" ")[0] || "there";
  const profileRequirements = current.profile
    ? [
        Boolean(current.profile.displayName?.trim()),
        Boolean(current.profile.headline?.trim() || current.profile.primaryRole?.trim()),
        Boolean(current.profile.bio?.trim()),
        current.profile.skills.some((skill) => skill.trim()),
      ]
    : [];
  const profileComplete = profileRequirements.length > 0 && profileRequirements.every(Boolean);
  const primaryStartAction = !profileComplete
    ? { href: "/profile", label: "Complete profile", icon: <UserRound size={16} /> }
    : !current.profile?.isPublic
      ? { href: "/profile", label: "Publish profile", icon: <ShieldCheck size={16} /> }
      : { href: "/discover", label: "Find work", icon: <Compass size={16} /> };
  const allVerified = Object.values(data.verification).every(Boolean);
  const released = presentAssetTotals(data.financials.released, "No confirmed releases this month");

  return (
    <AppShell>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Work with trust. Deliver with proof.</p>
          <h1>Welcome{displayName === "there" ? "" : `, ${displayName}`}</h1>
          <p>Here is what needs your attention across your jobs.</p>
        </div>
      </div>

      {data.isFirstTimeUser && (
        <section className="first-user-panel" aria-labelledby="welcome-title">
          <div>
            <p className="eyebrow">Start here</p>
            <h2 id="welcome-title">Welcome to Klaveroq</h2>
            <p>
              Build a trusted professional profile, discover opportunities or talent, and work
              through clear, verifiable milestones.
            </p>
          </div>
          <div className="first-user-actions">
            <Link className="primary-button" href={primaryStartAction.href}>
              {primaryStartAction.icon} {primaryStartAction.label}
            </Link>
            {primaryStartAction.href !== "/discover" && (
              <Link className="secondary-button" href="/discover">
                <Compass size={16} /> Find work
              </Link>
            )}
            <Link className="secondary-button" href="/talent">
              <UsersRound size={16} /> Find talent
            </Link>
            <Link className="secondary-button" href="/jobs/new/public">
              <Plus size={16} /> Post a job
            </Link>
          </div>
        </section>
      )}

      <section className="readiness-strip" aria-labelledby="readiness-title">
        <div className="readiness-icon">
          <ShieldCheck size={23} />
        </div>
        <div className="readiness-copy">
          <div>
            <h2 id="readiness-title">
              {allVerified ? "Ready for protected payments" : "Complete payment security"}
            </h2>
            {allVerified && (
              <span className="verified-label">
                <Check size={13} /> Verified
              </span>
            )}
          </div>
          <p>
            {allVerified
              ? "Your email, identity, and funding wallet are verified."
              : "Complete the remaining checks before protected payments are enabled."}
          </p>
        </div>
        <div className="readiness-items">
          <span>
            {data.verification.email && <Check size={15} />} Email{" "}
            {data.verification.email ? "verified" : "pending"}
          </span>
          <span>
            {data.verification.identity && <Check size={15} />} Identity{" "}
            {data.verification.identity ? "verified" : "pending"}
          </span>
          <span>
            {data.verification.wallet && <Check size={15} />} Wallet{" "}
            {data.verification.wallet ? "verified" : "pending"}
          </span>
        </div>
        <Link href="/wallet">
          Manage security <ArrowRight size={15} />
        </Link>
      </section>

      <section className="metrics-grid" aria-label="Account summary">
        <Metric
          icon={<BriefIcon />}
          tone="teal"
          label="Active jobs"
          value={String(data.activeJobCount)}
          note="Across client and worker roles"
        />
        <Metric
          icon={<CircleDollarSign size={20} />}
          tone="green"
          label="Secured in jobs"
          value="Unavailable"
          note="Awaiting reconciled PactAgent balances"
        />
        <Metric
          icon={<Clock3 size={20} />}
          tone="amber"
          label="Pending actions"
          value={String(data.pendingActions.length)}
          note={
            data.pendingActions.length ? "Items genuinely waiting on you" : "Nothing waiting on you"
          }
        />
        <Metric
          icon={<WalletCards size={20} />}
          tone="blue"
          label="Released this month"
          value={released.value}
          note={released.note}
        />
      </section>

      <div className="dashboard-grid">
        <section className="panel jobs-panel">
          <div className="section-heading">
            <div>
              <h2>Active jobs</h2>
              <p>Your current protected work</p>
            </div>
            <Link href="/jobs">
              View all <ArrowRight size={15} />
            </Link>
          </div>
          <div className="job-column-head" aria-hidden="true">
            <span>Job</span>
            <span>Status</span>
            <span>Value</span>
            <span>Next action</span>
            <span />
          </div>
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
                <p>No active jobs yet.</p>
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
            <span className="count-badge">{data.pendingActions.length}</span>
          </div>
          {data.pendingActions.length ? (
            data.pendingActions.slice(0, 4).map((action) => (
              <div className="action-item" key={`${action.jobId}-${action.title}`}>
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

      <section className="activity-panel">
        <div className="section-heading">
          <div>
            <h2>Recent activity</h2>
            <p>Authorized events across your workspace</p>
          </div>
          <Link href="/activity">
            Full activity <ArrowRight size={15} />
          </Link>
        </div>
        <div className="activity-list">
          {data.activity.length ? (
            data.activity.slice(0, 5).map((item) => (
              <div className="activity-row" key={item.id}>
                <span className="activity-dot blue" />
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
                <time>{item.createdAt.toLocaleString()}</time>
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
