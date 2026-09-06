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
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { activity } from "@/features/activity/fixtures";
import { jobs } from "@/features/jobs/fixtures";

const format = (value: number) => new Intl.NumberFormat("en-US").format(value);

import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { jobListings, proposals } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const current = await getCurrentUser();
  const displayName = current?.profile?.displayName?.split(" ")[0] || "there";
  const profileRequirements = current?.profile
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
    : !current?.profile?.isPublic
      ? { href: "/profile", label: "Publish profile", icon: <ShieldCheck size={16} /> }
      : { href: "/discover", label: "Find work", icon: <Compass size={16} /> };
  let marketplaceActivity = 0;
  if (current) {
    const [listingCount, proposalCount] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(jobListings)
        .where(eq(jobListings.clientUserId, current.user.id)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(proposals)
        .where(eq(proposals.workerUserId, current.user.id)),
    ]);
    marketplaceActivity =
      Number(listingCount[0]?.count ?? 0) + Number(proposalCount[0]?.count ?? 0);
  }
  return (
    <AppShell>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Work with trust. Deliver with proof.</p>
          <h1>Welcome{displayName === "there" ? "" : `, ${displayName}`}</h1>
          <p>
            {marketplaceActivity === 0
              ? "Set up your presence, then explore trusted work and talent."
              : "Here is what needs your attention across your jobs."}
          </p>
        </div>
      </div>

      {marketplaceActivity === 0 && (
        <section className="first-user-panel" aria-labelledby="welcome-title">
          <div>
            <p className="eyebrow">Start here</p>
            <h2 id="welcome-title">Welcome to Veyrivo</h2>
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

      {marketplaceActivity > 0 && (
        <>
          <section className="readiness-strip" aria-labelledby="readiness-title">
            <div className="readiness-icon">
              <ShieldCheck size={23} />
            </div>
            <div className="readiness-copy">
              <div>
                <h2 id="readiness-title">Ready for protected payments</h2>
                <span className="verified-label">
                  <Check size={13} /> Verified
                </span>
              </div>
              <p>Your identity and funding wallet are verified.</p>
            </div>
            <div className="readiness-items">
              <span>
                <Check size={15} /> Email
              </span>
              <span>
                <Check size={15} /> Identity
              </span>
              <span>
                <Check size={15} /> Wallet
              </span>
            </div>
            <Link href="/wallet">
              Manage security <ArrowRight size={15} />
            </Link>
          </section>

          <div className="dashboard-grid actions-first">
            <aside className="panel actions-panel">
              <div className="section-heading">
                <div>
                  <h2>Pending actions</h2>
                  <p>Items waiting on you</p>
                </div>
                <span className="count-badge">2</span>
              </div>
              <div className="action-item priority">
                <span className="action-icon">
                  <Clock3 size={18} />
                </span>
                <div>
                  <strong>Review milestone proof</strong>
                  <p>Checkout experience redesign</p>
                  <small>Review window closes in 2 days</small>
                  <Link href="/jobs/VY-1048">
                    Review proof <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
              <div className="action-item">
                <span className="action-icon green">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <strong>Invitation funded</strong>
                  <p>Brand launch photography</p>
                  <small>Waiting for Mira to accept</small>
                  <Link href="/jobs/VY-1046">
                    View invitation <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </aside>

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
                {jobs.map((job) => (
                  <Link className="job-row" href={`/jobs/${job.id}`} key={job.id}>
                    <div className="job-title">
                      <span className={`role-mark ${job.role.toLowerCase()}`}>
                        {job.role === "CLIENT" ? "C" : "W"}
                      </span>
                      <div>
                        <strong>{job.title}</strong>
                        <span>
                          {job.counterparty} · {job.id}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={job.displayStatus} />
                    <div className="job-value">
                      <strong>
                        {format(job.total)} {job.asset}
                      </strong>
                      <span>{job.milestoneProgress} milestones</span>
                    </div>
                    <div className="job-next">
                      <strong>{job.nextAction}</strong>
                      <span>Updated {job.updatedAt}</span>
                    </div>
                    <ArrowRight className="row-arrow" size={18} />
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <section className="metrics-grid metrics-secondary" aria-label="Account summary">
            <article>
              <span className="metric-icon teal">
                <BriefIcon />
              </span>
              <div>
                <p>Active jobs</p>
                <strong>3</strong>
                <small>Across client and worker roles</small>
              </div>
            </article>
            <article>
              <span className="metric-icon green">
                <CircleDollarSign size={20} />
              </span>
              <div>
                <p>Secured in jobs</p>
                <strong>
                  260,500 <em>CKB</em>
                </strong>
                <small>Funds confirmed by PactAgent</small>
              </div>
            </article>
            <article>
              <span className="metric-icon amber">
                <Clock3 size={20} />
              </span>
              <div>
                <p>Pending actions</p>
                <strong>2</strong>
                <small>One review, one acceptance</small>
              </div>
            </article>
            <article>
              <span className="metric-icon blue">
                <WalletCards size={20} />
              </span>
              <div>
                <p>Released this month</p>
                <strong>
                  129,500 <em>CKB</em>
                </strong>
                <small>4 milestone payments</small>
              </div>
            </article>
          </section>

          <section className="activity-panel">
            <div className="section-heading">
              <div>
                <h2>Recent activity</h2>
                <p>Verified events across your workspace</p>
              </div>
              <Link href="/activity">
                Full activity <ArrowRight size={15} />
              </Link>
            </div>
            <div className="activity-list">
              {activity.map((item) => (
                <div className="activity-row" key={item.title + item.detail}>
                  <span className={`activity-dot ${item.tone}`} />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </div>
                  <time>{item.time}</time>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {marketplaceActivity === 0 && (
        <section className="market-empty dashboard-empty">
          <Compass size={28} />
          <h2>Your workspace is ready</h2>
          <p>Jobs, proposals, messages, and verified marketplace activity will appear here.</p>
        </section>
      )}
    </AppShell>
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
