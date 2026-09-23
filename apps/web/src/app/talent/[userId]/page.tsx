import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  ExternalLink,
  Github,
  Globe2,
  MapPin,
  Star,
  Send,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketplaceHeader } from "@/features/marketplace/components/marketplace-header";
import { getTalentForViewer } from "@/features/talent/server/queries";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

export default async function PublicTalentProfile({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const current = await getCurrentUser();
  const isOwner = current?.user.id === userId;
  const talent = await getTalentForViewer(userId, current?.user.id);
  if (!talent) notFound();
  const { profile, portfolio, reputation } = talent;
  return (
    <div className="market-page public-talent-page">
      <MarketplaceHeader />
      <main>
        {isOwner && !current.profile?.isPublic && (
          <p className="private-preview-notice">
            Private profile preview. Other marketplace users cannot view this page.
          </p>
        )}
        <Link className="back-link" href="/talent">
          <ArrowLeft size={16} /> Back to talent
        </Link>
        <div className="public-talent-layout">
          <div>
            <section className="public-profile-hero">
              <span className="profile-avatar">
                {profile.displayName.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <div className="public-profile-name">
                  <h1>{profile.displayName}</h1>
                  {reputation.identityVerified && (
                    <span className="verified-chip">
                      <BadgeCheck size={13} /> Identity verified
                    </span>
                  )}
                </div>
                <p>{profile.headline || profile.primaryRole || "Klaveroq professional"}</p>
                <div className="talent-meta">
                  {profile.countryCode && (
                    <span>
                      <MapPin size={14} /> {countryNames.of(profile.countryCode)}
                    </span>
                  )}
                  <span>
                    <Clock3 size={14} /> {profile.timezone}
                  </span>
                  <span
                    className={`availability availability-${profile.availability.toLowerCase()}`}
                  >
                    {profile.availability.toLowerCase()}
                  </span>
                </div>
              </div>
            </section>
            <section className="public-profile-section">
              <h2>About</h2>
              <p>{profile.bio || "This professional has not added a bio yet."}</p>
            </section>
            <section className="public-profile-section">
              <h2>Professional focus</h2>
              <dl className="professional-facts">
                <div>
                  <dt>Primary role</dt>
                  <dd>{profile.primaryRole || "Not specified"}</dd>
                </div>
                <div>
                  <dt>Experience</dt>
                  <dd>
                    {profile.experienceLevel?.toLowerCase() || "Not specified"}
                    {profile.yearsExperience !== null ? ` · ${profile.yearsExperience} years` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Languages</dt>
                  <dd>{profile.languages.join(", ") || "Not specified"}</dd>
                </div>
              </dl>
              <div className="skill-list">
                {profile.skills.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
              <div className="profile-links">
                {profile.githubUrl && (
                  <a href={profile.githubUrl} target="_blank" rel="noreferrer">
                    <Github size={15} /> GitHub
                  </a>
                )}
                {profile.websiteUrl && (
                  <a href={profile.websiteUrl} target="_blank" rel="noreferrer">
                    <Globe2 size={15} /> Website
                  </a>
                )}
                {profile.linkedinUrl && (
                  <a href={profile.linkedinUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} /> LinkedIn
                  </a>
                )}
              </div>
            </section>
            <section className="public-profile-section portfolio-public" id="portfolio">
              <div className="section-heading plain-heading">
                <div>
                  <h2>Portfolio</h2>
                  <p>
                    {portfolio.length} public {portfolio.length === 1 ? "project" : "projects"}
                  </p>
                </div>
              </div>
              {portfolio.length ? (
                <div className="portfolio-public-grid">
                  {portfolio.map((item) => (
                    <article key={item.id}>
                      <h3>{item.title}</h3>
                      <span>{item.projectRole || "Project contributor"}</span>
                      <p>{item.description}</p>
                      <div className="skill-list">
                        {item.skills.map((skill) => (
                          <span key={skill}>{skill}</span>
                        ))}
                      </div>
                      <footer>
                        {item.projectUrl && (
                          <a href={item.projectUrl} target="_blank" rel="noreferrer">
                            <ExternalLink size={14} /> View project
                          </a>
                        )}
                        {item.githubUrl && (
                          <a href={item.githubUrl} target="_blank" rel="noreferrer">
                            <Github size={14} /> Source
                          </a>
                        )}
                      </footer>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="market-empty compact-empty">
                  <p>No portfolio projects published yet.</p>
                </div>
              )}
            </section>
          </div>
          <aside>
            {!isOwner && current && (
              <section className="talent-hire-actions">
                <p className="eyebrow">Work together</p>
                <h2>Interested in this professional?</h2>
                <p>Structure the work with clear milestones and protected payment.</p>
                <Link className="primary-button" href={`/jobs/new/direct?talent=${profile.userId}`}>
                  <Send size={16} /> Invite to a job
                </Link>
                <a className="secondary-button" href="#portfolio">
                  View portfolio
                </a>
              </section>
            )}
            <section className="reputation-public">
              <p className="eyebrow">Verified Klaveroq work</p>
              <div className="reputation-score">
                <Star size={21} fill={reputation.averageRating ? "currentColor" : "none"} />
                <strong>{reputation.averageRating?.toFixed(1) ?? "New"}</strong>
                <span>
                  {reputation.reviewCount} verified{" "}
                  {reputation.reviewCount === 1 ? "review" : "reviews"}
                </span>
              </div>
              <dl>
                <div>
                  <dt>Completed jobs</dt>
                  <dd>{reputation.completedJobs}</dd>
                </div>
                <div>
                  <dt>Released milestones</dt>
                  <dd>{reputation.completedMilestones}</dd>
                </div>
                <div>
                  <dt>On-time completion</dt>
                  <dd>
                    {reputation.onTimeRate === null ? "Not available" : `${reputation.onTimeRate}%`}
                  </dd>
                </div>
                <div>
                  <dt>Repeat clients</dt>
                  <dd>{reputation.repeatClients}</dd>
                </div>
              </dl>
              <p className="verified-work-note">
                <BadgeCheck size={14} /> Statistics are derived from completed Klaveroq engagements.
              </p>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
