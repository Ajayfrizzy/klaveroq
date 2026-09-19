import { ArrowRight, BriefcaseBusiness, Compass, Filter, Plus, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { jobs as fixtureJobs } from "@/features/jobs/fixtures";
import { db } from "@/server/db";
import { jobListings, profiles, proposals } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/session";
import { usesPreviewData } from "@/server/deployment";

export const dynamic = "force-dynamic";
const ckb = (value: bigint) => new Intl.NumberFormat().format(Number(value) / 100_000_000);
export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view = "agreements" } = await searchParams;
  const preview = usesPreviewData();
  const current = preview ? null : await getCurrentUser();
  if (!preview && !current) {
    const returnTo = view === "agreements" ? "/jobs" : `/jobs?view=${view}`;
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  const userId = current?.user.id;
  const listings =
    view === "listings" && userId
      ? await db
          .select()
          .from(jobListings)
          .where(eq(jobListings.clientUserId, userId))
          .orderBy(desc(jobListings.updatedAt))
      : [];
  const bids =
    view === "proposals" && userId
      ? await db
          .select({ proposal: proposals, listing: jobListings, clientName: profiles.displayName })
          .from(proposals)
          .innerJoin(jobListings, eq(proposals.listingId, jobListings.id))
          .innerJoin(profiles, eq(jobListings.clientUserId, profiles.userId))
          .where(eq(proposals.workerUserId, userId))
          .orderBy(desc(proposals.updatedAt))
      : [];
  return (
    <AppShell>
      <PageHeader
        eyebrow="Workspace"
        title="Jobs"
        description="Manage agreements, public listings, and proposals."
        icon={BriefcaseBusiness}
        action={
          <Link className="primary-button" href="/jobs/new">
            <Plus size={17} /> Create job
          </Link>
        }
      />
      <div className="workspace-tabs">
        <Link className={view === "agreements" ? "active" : ""} href="/jobs">
          Agreements
        </Link>
        <Link className={view === "listings" ? "active" : ""} href="/jobs?view=listings">
          My listings
        </Link>
        <Link className={view === "proposals" ? "active" : ""} href="/jobs?view=proposals">
          My proposals
        </Link>
      </div>
      {view === "agreements" && (
        <>
          <div className="toolbar">
            <label className="search-field">
              <Search size={17} />
              <input aria-label="Search jobs" placeholder="Search jobs or people" />
            </label>
            <button className="secondary-button">
              <Filter size={16} /> Filter
            </button>
          </div>
          <section className="panel data-panel">
            <div className="data-head">
              <span>Job</span>
              <span>Status</span>
              <span>Value</span>
              <span>Progress</span>
              <span>Next action</span>
              <span />
            </div>
            {fixtureJobs.map((job) => (
              <Link className="data-row job-data-row" href={`/jobs/${job.id}`} key={job.id}>
                <div className="entity-cell">
                  <span className={`role-mark ${job.role.toLowerCase()}`}>{job.role[0]}</span>
                  <p>
                    <strong>{job.title}</strong>
                    <small>
                      {job.counterparty} · {job.id} · As {job.role.toLowerCase()}
                    </small>
                  </p>
                </div>
                <StatusBadge status={job.displayStatus} />
                <strong>
                  {new Intl.NumberFormat().format(job.total)} {job.asset}
                </strong>
                <span>{job.milestoneProgress} milestones</span>
                <span>{job.nextAction}</span>
                <ArrowRight size={17} />
              </Link>
            ))}
          </section>
        </>
      )}
      {view === "listings" && (
        <section className="panel workspace-market-list">
          {listings.length ? (
            listings.map((listing) => (
              <Link href={`/discover/${listing.id}`} key={listing.id}>
                <div>
                  <strong>{listing.title}</strong>
                  <small>
                    {listing.category.toLowerCase()} · Updated{" "}
                    {listing.updatedAt.toLocaleDateString()}
                  </small>
                </div>
                <span className={`listing-status state-${listing.status.toLowerCase()}`}>
                  {listing.status.toLowerCase()}
                </span>
                <b>
                  {ckb(listing.budgetMin)}–{ckb(listing.budgetMax)} CKB
                </b>
                <ArrowRight size={17} />
              </Link>
            ))
          ) : (
            <div className="market-empty account-empty">
              <BriefcaseBusiness size={26} />
              <h2>No jobs yet</h2>
              <p>Post a job to start comparing proposals from Klaveroq professionals.</p>
              <Link className="primary-button" href="/jobs/new/public">
                <Plus size={16} /> Post a job
              </Link>
            </div>
          )}
        </section>
      )}
      {view === "proposals" && (
        <section className="panel workspace-market-list">
          {bids.length ? (
            bids.map(({ proposal, listing, clientName }) => (
              <Link href={`/discover/${listing.id}`} key={proposal.id}>
                <div>
                  <strong>{listing.title}</strong>
                  <small>
                    {clientName} · Updated {proposal.updatedAt.toLocaleDateString()}
                  </small>
                </div>
                <span className={`proposal-state state-${proposal.status.toLowerCase()}`}>
                  {proposal.status.toLowerCase()}
                </span>
                <b>{ckb(proposal.totalBid)} CKB</b>
                <ArrowRight size={17} />
              </Link>
            ))
          ) : (
            <div className="market-empty account-empty">
              <Compass size={26} />
              <h2>No proposals yet</h2>
              <p>Browse opportunities that match your skills and submit your first proposal.</p>
              <Link className="primary-button" href="/discover">
                <Compass size={16} /> Find work
              </Link>
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
}
