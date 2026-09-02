import { JOB_CATEGORIES } from "@veyrivo/domain";
import { ArrowRight, BriefcaseBusiness, CalendarDays, Search, UsersRound } from "lucide-react";
import Link from "next/link";
import { MarketplaceHeader } from "@/features/marketplace/components/marketplace-header";
import { listPreviewMarketplaceListings } from "@/features/marketplace/fixtures";
import { listPublicListings } from "@/features/marketplace/server/queries";
import { listingQuerySchema } from "@/features/marketplace/server/schemas";
import { usesPreviewData } from "@/server/deployment";
export const dynamic = "force-dynamic";
const ckb = (value: bigint) => new Intl.NumberFormat().format(Number(value) / 100_000_000);
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const scalar = Object.fromEntries(
    Object.entries(raw).flatMap(([key, value]) =>
      typeof value === "string" ? [[key, value]] : [],
    ),
  );
  const input = listingQuerySchema.parse(scalar);
  const result = usesPreviewData()
    ? listPreviewMarketplaceListings(input)
    : await listPublicListings(input);
  return (
    <div className="market-page">
      <MarketplaceHeader />
      <main>
        <section className="market-title">
          <div>
            <p className="eyebrow">Veyrivo marketplace</p>
            <h1>Find work built around clear, verifiable milestones</h1>
            <p>
              Work with defined deliverables, objective acceptance criteria, required proof, and
              protected payment.
            </p>
          </div>
          <Link className="primary-button" href="/jobs/new/public">
            Post a job
          </Link>
        </section>
        <form className="market-filters">
          <label className="search-field">
            <Search size={17} />
            <input
              name="query"
              defaultValue={input.query}
              placeholder="Search jobs, outcomes, or skills"
            />
          </label>
          <select name="category" defaultValue={input.category ?? ""} aria-label="Category">
            <option value="">All categories</option>
            {JOB_CATEGORIES.map((category) => (
              <option value={category} key={category}>
                {category.toLowerCase()}
              </option>
            ))}
          </select>
          <input name="skill" defaultValue={input.skill} placeholder="Skill" aria-label="Skill" />
          <select name="sort" defaultValue={input.sort} aria-label="Sort">
            <option value="newest">Newest</option>
            <option value="budget">Highest budget</option>
          </select>
          <button className="secondary-button">Apply filters</button>
        </form>
        {result.data.length ? (
          <section className="listing-grid">
            {result.data.map(({ listing, client, proposalCount }) => (
              <Link className="listing-card" href={`/discover/${listing.id}`} key={listing.id}>
                <div className="listing-card-top">
                  <span>{listing.category.toLowerCase()}</span>
                  <small>{new Date(listing.publishedAt!).toLocaleDateString()}</small>
                </div>
                <h2>{listing.title}</h2>
                <p>{listing.description}</p>
                <div className="skill-list">
                  {listing.skills.slice(0, 4).map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))}
                </div>
                <dl>
                  <div>
                    <dt>Budget</dt>
                    <dd>
                      {ckb(listing.budgetMin)}–{ckb(listing.budgetMax)} CKB
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <UsersRound size={14} /> Proposals
                    </dt>
                    <dd>{proposalCount}</dd>
                  </div>
                  <div>
                    <dt>
                      <CalendarDays size={14} /> Deadline
                    </dt>
                    <dd>{new Date(listing.proposalDeadline).toLocaleDateString()}</dd>
                  </div>
                </dl>
                <footer>
                  <span className="client-mark">
                    {client.displayName.slice(0, 2).toUpperCase()}
                  </span>
                  <p>
                    <strong>{client.displayName}</strong>
                    <small>{client.headline ?? "Veyrivo client"}</small>
                  </p>
                  <ArrowRight size={17} />
                </footer>
              </Link>
            ))}
          </section>
        ) : (
          <section className="market-empty">
            <BriefcaseBusiness size={28} />
            <h2>No matching jobs</h2>
            <p>Adjust the filters or check back for newly published work.</p>
          </section>
        )}
        {result.nextCursor && (
          <Link
            className="secondary-button load-more"
            href={{
              pathname: "/discover",
              query: { ...scalar, cursor: result.nextCursor },
            }}
          >
            Load more
          </Link>
        )}
      </main>
    </div>
  );
}
