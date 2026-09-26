import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Clock3,
  Filter,
  Star,
  UsersRound,
} from "lucide-react";
import { JOB_CATEGORIES } from "@klaveroq/domain";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MarketplaceLayout } from "@/features/marketplace/components/marketplace-layout";
import { listTalent } from "@/features/talent/server/queries";
import { talentQuerySchema } from "@/features/talent/server/schemas";
import { DiscoveryFilters } from "@/features/marketplace/components/discovery-filters";
import { SavedSearches } from "@/features/marketplace/components/saved-searches";
import {
  TalentTools,
  ShortlistButton,
  TimezoneContext,
} from "@/features/talent/components/talent-tools";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

export default async function TalentPage({
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
  const parsed = talentQuerySchema.safeParse(scalar);
  if (!parsed.success) redirect("/talent");
  const input = parsed.data;
  const result = await listTalent(input);
  const current = await getCurrentUser();
  const hasAppliedFilters = Boolean(
    input.query ||
    input.skill ||
    input.category ||
    input.availability ||
    input.role ||
    input.minCompletedJobs > 0,
  );
  return (
    <MarketplaceLayout>
      <section className="market-title">
        <div>
          <p className="eyebrow">Klaveroq talent marketplace</p>
          <h1>Find professionals with verifiable work history</h1>
          <p>
            Compare skills, portfolios, availability, and reputation earned through completed
            Klaveroq work.
          </p>
        </div>
        <Link className="secondary-button" href="/discover">
          <BriefcaseBusiness size={16} /> Find work
        </Link>
      </section>
      <DiscoveryFilters key={JSON.stringify(scalar)} query={input.query} count={result.data.length}>
        <input name="skill" defaultValue={input.skill} placeholder="Skill" aria-label="Skill" />
        <select name="category" defaultValue={input.category ?? ""} aria-label="Work category">
          <option value="">Any category</option>
          {JOB_CATEGORIES.map((category) => (
            <option value={category} key={category}>
              {category.toLowerCase()}
            </option>
          ))}
        </select>
        <select
          name="availability"
          defaultValue={input.availability ?? ""}
          aria-label="Availability"
        >
          <option value="">Any availability</option>
          <option value="AVAILABLE">Available</option>
          <option value="LIMITED">Limited</option>
          <option value="UNAVAILABLE">Unavailable</option>
        </select>
        <details className="advanced-filters">
          <summary>
            <Filter size={16} /> More filters
          </summary>
          <div>
            <input
              name="role"
              defaultValue={input.role}
              placeholder="Professional role"
              aria-label="Role"
            />
            <select
              name="minCompletedJobs"
              defaultValue={input.minCompletedJobs}
              aria-label="Completed work"
            >
              <option value="0">Any work history</option>
              <option value="1">1+ completed job</option>
              <option value="5">5+ completed jobs</option>
              <option value="10">10+ completed jobs</option>
            </select>
            <select name="sort" defaultValue={input.sort} aria-label="Sort talent">
              <option value="reputation">Best reputation</option>
              <option value="completed">Most completed work</option>
              <option value="recent">Recently updated</option>
            </select>
          </div>
        </details>
      </DiscoveryFilters>
      <SavedSearches key={current?.user.id ?? "guest"} scope={current?.user.id ?? "guest"} />
      <TalentTools key={current?.user.id ?? "guest"} scope={current?.user.id ?? "guest"}>
        {result.data.length ? (
          <section className="talent-grid">
            {result.data.map(({ profile, reputation, portfolioPreview }) => (
              <article className="talent-card" key={profile.userId}>
                <div className="talent-card-head">
                  <span className="profile-avatar">
                    {profile.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.avatarUrl}
                        alt={profile.avatarAltText ?? `${profile.displayName} profile photo`}
                      />
                    ) : (
                      profile.displayName.slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <div>
                    <h2>{profile.displayName}</h2>
                    <p>{profile.headline || profile.primaryRole || "Klaveroq professional"}</p>
                  </div>
                </div>
                <div className="skill-list">
                  {profile.skills.slice(0, 5).map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))}
                </div>
                <div className="talent-meta">
                  {reputation.identityVerified && (
                    <span>
                      <BadgeCheck size={14} /> Identity verified
                    </span>
                  )}
                  {profile.countryCode && <span>{countryNames.of(profile.countryCode)}</span>}
                  <span>
                    <Clock3 size={13} /> {profile.timezone}
                  </span>
                  <TimezoneContext timezone={profile.timezone} />
                  <span
                    className={`availability availability-${profile.availability.toLowerCase()}`}
                  >
                    <CircleAvailability />{" "}
                    {profile.availability === "LIMITED"
                      ? "Limited availability"
                      : profile.availability.toLowerCase()}
                  </span>
                </div>
                {portfolioPreview.length > 0 && (
                  <div className="talent-portfolio-preview">
                    <span>Portfolio</span>
                    <p>{portfolioPreview.map((item) => item.title).join(" · ")}</p>
                  </div>
                )}
                <dl className="talent-stats">
                  <div>
                    <dt>
                      <Star size={13} /> Verified rating
                    </dt>
                    <dd>{reputation.averageRating?.toFixed(1) ?? "New"}</dd>
                  </div>
                  <div>
                    <dt>Completed jobs</dt>
                    <dd>{reputation.completedJobs}</dd>
                  </div>
                  <div className="secondary-stat">
                    <dt>Released milestones</dt>
                    <dd>{reputation.completedMilestones}</dd>
                  </div>
                </dl>
                <p className="trust-source">
                  Skills and availability are self-reported. Ratings come from completed Klaveroq
                  work.
                </p>
                <ShortlistButton id={profile.userId} name={profile.displayName} />
                <Link
                  className="secondary-button talent-profile-link"
                  href={`/talent/${profile.userId}`}
                >
                  View profile <ArrowRight size={15} />
                </Link>
              </article>
            ))}
          </section>
        ) : (
          <section className="market-empty">
            <UsersRound size={28} />
            <h2>
              {hasAppliedFilters ? "No matching professionals" : "Be among the first professionals"}
            </h2>
            <p>
              {hasAppliedFilters
                ? "Try fewer filters or a broader search."
                : "Public profiles will appear here. Publish yours or post a job to invite proposals."}
            </p>
            <div className="empty-actions">
              <Link className="primary-button" href={hasAppliedFilters ? "/talent" : "/profile"}>
                {hasAppliedFilters ? "Clear filters" : "Create your profile"}
              </Link>
              <Link className="secondary-button" href="/jobs/new/public">
                Post a job
              </Link>
              <Link className="secondary-button" href="/discover">
                Find work
              </Link>
            </div>
          </section>
        )}
      </TalentTools>
      {result.nextCursor && (
        <Link
          className="secondary-button load-more"
          href={{ pathname: "/talent", query: { ...scalar, cursor: result.nextCursor } }}
        >
          Next page
        </Link>
      )}
    </MarketplaceLayout>
  );
}

function CircleAvailability() {
  return <span className="availability-dot" aria-hidden="true" />;
}
