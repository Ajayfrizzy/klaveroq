import { ArrowRight, BriefcaseBusiness, Compass, Filter, Plus, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { db } from "@/server/db";
import { jobListings, jobs, profiles, proposals } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/session";
import {
  agreementStatuses,
  agreementStatusLabel,
  jobWorkspaceQuerySchema,
} from "@/features/jobs/server/filters";

export const dynamic = "force-dynamic";
const ckb = (value: bigint) => new Intl.NumberFormat().format(Number(value) / 100_000_000);
export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const input = jobWorkspaceQuerySchema.parse(
    Object.fromEntries(
      Object.entries(raw).flatMap(([key, value]) =>
        typeof value === "string" ? [[key, value]] : [],
      ),
    ),
  );
  const { view, query, status } = input;
  const current = await getCurrentUser();
  if (!current) {
    const returnTo = view === "agreements" ? "/jobs" : `/jobs?view=${view}`;
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  const userId = current?.user.id;
  const agreementConditions = [or(eq(jobs.clientUserId, userId), eq(jobs.workerUserId, userId))!];
  if (status) agreementConditions.push(eq(jobs.status, status));
  if (query) {
    const pattern = `%${query}%`;
    agreementConditions.push(
      or(
        ilike(jobs.title, pattern),
        ilike(jobs.reference, pattern),
        ilike(jobs.workerEmail, pattern),
        sql`exists (
          select 1 from ${profiles} participant
          where participant.user_id in (${jobs.clientUserId}, ${jobs.workerUserId})
          and participant.display_name ilike ${pattern}
        )`,
      )!,
    );
  }
  const agreements =
    view === "agreements" && userId
      ? await db
          .select()
          .from(jobs)
          .where(and(...agreementConditions))
          .orderBy(desc(jobs.updatedAt))
      : [];
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
          <form className="toolbar">
            <input type="hidden" name="view" value="agreements" />
            <label className="search-field">
              <Search size={17} />
              <input
                name="query"
                defaultValue={query}
                aria-label="Search jobs"
                placeholder="Search jobs or people"
              />
            </label>
            <select name="status" defaultValue={status ?? ""} aria-label="Filter by status">
              <option value="">All statuses</option>
              {agreementStatuses.map((value) => (
                <option value={value} key={value}>
                  {agreementStatusLabel(value)}
                </option>
              ))}
            </select>
            <button className="secondary-button" type="submit">
              <Filter size={16} /> Apply filters
            </button>
            {(query || status) && (
              <Link className="clear-filters" href="/jobs">
                Clear filters
              </Link>
            )}
          </form>
          <section className="panel data-panel">
            <div className="data-head">
              <span>Job</span>
              <span>Status</span>
              <span>Value</span>
              <span>Progress</span>
              <span>Next action</span>
              <span />
            </div>
            {agreements.length ? (
              agreements.map((job) => {
                const role = job.clientUserId === userId ? "CLIENT" : "WORKER";
                return (
                  <Link className="data-row job-data-row" href={`/jobs/${job.id}`} key={job.id}>
                    <div className="entity-cell">
                      <span className={`role-mark ${role.toLowerCase()}`}>{role[0]}</span>
                      <p>
                        <strong>{job.title}</strong>
                        <small>
                          {job.reference} · As {role.toLowerCase()}
                        </small>
                      </p>
                    </div>
                    <StatusBadge status={job.status} />
                    <strong>
                      {ckb(job.subtotal)} {job.asset}
                    </strong>
                    <span>Open for milestones</span>
                    <span>View agreement</span>
                    <ArrowRight size={17} />
                  </Link>
                );
              })
            ) : (
              <div className="market-empty account-empty">
                <BriefcaseBusiness size={26} />
                <h2>{query || status ? "No matching agreements" : "No agreements yet"}</h2>
                <p>
                  {query || status
                    ? "Adjust or clear the filters to see other authorized agreements."
                    : "Your client and worker agreements will appear here."}
                </p>
              </div>
            )}
          </section>
        </>
      )}
      {view === "listings" && (
        <section className="panel workspace-market-list">
          {listings.length ? (
            listings.map((listing) => (
              <Link
                href={
                  listing.status === "DRAFT"
                    ? `/jobs/new/public?draft=${listing.id}`
                    : `/discover/${listing.id}`
                }
                key={listing.id}
              >
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
