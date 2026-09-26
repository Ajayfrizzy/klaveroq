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

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  const data = await getDashboardData(current.user.id, Boolean(current.user.emailVerifiedAt));
  const displayName = current.profile?.displayName?.split(" ")[0] || "there";
  const profileComplete = Boolean(
    current.profile && getMissingPublicationFields(current.profile).length === 0,
  );
  const allChecksRecorded = Object.values(data.verification).every(Boolean);

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
        published={Boolean(current.profile?.isPublic)}
      />

      <section className="readiness-strip" aria-labelledby="readiness-title">
        <div className="readiness-icon">
          <ShieldCheck size={23} />
        </div>
        <div className="readiness-copy">
          <div>
            <h2 id="readiness-title">
              {allChecksRecorded ? "Account verification complete" : "Finish account verification"}
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
          icon={<Clock3 size={20} />}
          tone="amber"
          label="Pending actions"
          value={String(data.pendingActionCount)}
          note={data.pendingActionCount ? "Items waiting on you" : "Nothing waiting on you"}
        />
      </section>

      <p className="payment-availability">
        Payment integration is not connected. Funding and payouts are unavailable.{" "}
        <Link href="/payments">View payment status</Link>
      </p>

      <div className="dashboard-grid">
        <section className="panel jobs-panel">
          <div className="section-heading">
            <div>
              <h2>Active jobs</h2>
              <p>Your current marketplace work</p>
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
