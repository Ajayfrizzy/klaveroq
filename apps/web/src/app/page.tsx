import { HeroScene, ReputationNotes } from "@/features/marketplace/components/landing-interactions";
import { optionalOperation } from "@/server/observability/operations";
import { getRenderRequestId } from "@/server/observability/render-context";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileCheck2,
  Layers3,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { MarketplaceHeader } from "@/features/marketplace/components/marketplace-header";
import { listTalent } from "@/features/talent/server/queries";
import { talentQuerySchema } from "@/features/talent/server/schemas";
import { listPublicListings } from "@/features/marketplace/server/queries";
import { listingQuerySchema } from "@/features/marketplace/server/schemas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Work with trust. Deliver with proof.",
  description:
    "Find opportunities, discover independent professionals, and build working relationships around clear milestones and verifiable delivery.",
};

export default async function HomePage() {
  const requestId = await getRenderRequestId();
  const [talentResult, jobResult] = await Promise.all([
    optionalOperation(requestId, "marketplace.talent_preview", () =>
      listTalent(talentQuerySchema.parse({ limit: 6 })),
    ),
    optionalOperation(requestId, "marketplace.jobs_preview", () =>
      listPublicListings(listingQuerySchema.parse({ limit: 3 })),
    ),
  ]);
  const talent = talentResult?.data ?? null;
  const jobs = jobResult?.data ?? null;
  return (
    <div className="public-site">
      <MarketplaceHeader />
      <main>
        <section className="home-hero public-container">
          <div className="hero-copy">
            <p className="public-kicker">
              <span /> Independent talent. Shared ambition.
            </p>
            <h1>
              Work with people
              <br />
              you can <em>trust.</em>
            </h1>
            <p className="hero-description">
              Find your next opportunity. Discover the right professional. Move great work forward
              with clear milestones and proof of delivery.
            </p>
            <div className="public-actions">
              <Link className="primary-button" href="/jobs">
                Find work <ArrowUpRight size={18} />
              </Link>
              <Link className="secondary-button" href="/talent">
                Hire talent <ArrowRight size={18} />
              </Link>
            </div>
            <p className="hero-footnote">
              Explore first. Join when you’re ready. <Link href="/login">Sign in</Link>
            </p>
          </div>
          <HeroScene>
            <div className="scene-orbit" />
            <div className="glass-card scene-profile">
              <div className="scene-card-label">
                <span className="scene-icon">
                  <Sparkles size={20} />
                </span>{" "}
                The right expertise <ArrowUpRight size={17} />
              </div>
              <h2>
                Good work starts
                <br />
                with the right people.
              </h2>
              <div className="skill-list">
                <span>Design</span>
                <span>Development</span>
                <span>Strategy</span>
              </div>
            </div>
            <div className="glass-card scene-milestone">
              <div className="scene-card-label">
                <Layers3 size={17} /> A shared plan <span className="scene-dot" />
              </div>
              <h3>Clarity at every milestone</h3>
              <p>
                <Check size={15} /> Agree on the deliverable
              </p>
              <p>
                <Check size={15} /> Define what success looks like
              </p>
              <div className="scene-progress">
                <span />
              </div>
            </div>
            <div className="glass-card scene-proof">
              <span className="proof-icon">
                <FileCheck2 size={23} />
              </span>
              <div>
                <strong>Let the work speak.</strong>
                <p>Deliver. Review. Build reputation.</p>
              </div>
            </div>
            <span className="scene-caption">A clearer way to work · Product illustration</span>
          </HeroScene>
        </section>
        <div className="home-principles">
          <div className="public-container">
            <span>Work with trust. Deliver with proof.</span>
            <span>
              <Check size={16} /> Clear expectations
            </span>
            <span>
              <Check size={16} /> Visible expertise
            </span>
            <span>
              <Check size={16} /> Verifiable delivery
            </span>
          </div>
        </div>
        <section
          className="public-section public-container home-market-preview"
          data-count={jobs?.length ?? 0}
        >
          <div className="public-section-heading">
            <div>
              <p className="public-kicker">Find your next chapter</p>
              <h2>Work worth doing.</h2>
              <p>Open opportunities from the Klaveroq marketplace.</p>
            </div>
            <Link href="/jobs">
              Explore all jobs <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="home-jobs">
            {jobs?.length ? (
              jobs.map(({ listing }) => (
                <Link className="home-job-card" href={`/jobs/${listing.id}`} key={listing.id}>
                  <div>
                    <span className="public-kicker">{listing.category.toLowerCase()}</span>
                    <ArrowUpRight size={19} />
                  </div>
                  <h3>{listing.title}</h3>
                  <p>{listing.description.slice(0, 150)}</p>
                  <div className="skill-list">
                    {listing.skills.slice(0, 3).map((skill) => (
                      <span key={skill}>{skill}</span>
                    ))}
                  </div>
                  <footer>
                    <span>Proposals close</span>
                    <strong>
                      {listing.proposalDeadline.toLocaleDateString("en", {
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      })}
                    </strong>
                  </footer>
                </Link>
              ))
            ) : (
              <div className="public-empty">
                <Layers3 size={26} />
                <h3>
                  {jobs
                    ? "Your next opportunity starts here."
                    : "Opportunities are temporarily unavailable."}
                </h3>
                <p>
                  {jobs
                    ? "We’re building a community of ambitious professionals and thoughtful clients. Have a project in mind? Start the conversation with a clear brief."
                    : "Please try browsing jobs again shortly."}
                </p>
                <Link href="/jobs/new/public">
                  Post an opportunity <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </div>
        </section>
        <section className="home-talent-section">
          <div
            className="public-section public-container home-market-preview"
            data-count={talent?.length ?? 0}
          >
            <div className="public-section-heading">
              <div>
                <p className="public-kicker">People behind the possibilities</p>
                <h2>Meet your next collaborator.</h2>
                <p>Real skills, individual perspectives, and room to build something great.</p>
              </div>
              <Link href="/talent">
                Browse all talent <ArrowUpRight size={18} />
              </Link>
            </div>
            <div className="home-talent-grid">
              {talent?.length ? (
                talent.map(({ profile, reputation }) => (
                  <Link
                    className="home-talent-card"
                    href={`/talent/${profile.userId}`}
                    key={profile.userId}
                  >
                    <div className="home-talent-top">
                      <span className="profile-avatar">
                        {profile.displayName.slice(0, 2).toUpperCase()}
                      </span>
                      <ArrowUpRight size={18} />
                    </div>
                    <h3>{profile.displayName}</h3>
                    <p>{profile.headline || profile.primaryRole}</p>
                    <div className="skill-list">
                      {profile.skills.slice(0, 3).map((skill) => (
                        <span key={skill}>{skill}</span>
                      ))}
                    </div>
                    <small>
                      {reputation.completedJobs
                        ? `${reputation.completedJobs} completed Klaveroq engagements`
                        : "New on Klaveroq"}
                    </small>
                  </Link>
                ))
              ) : (
                <div className="public-empty">
                  <Sparkles size={26} />
                  <h3>
                    {talent
                      ? "Make your expertise discoverable."
                      : "Talent previews are temporarily unavailable."}
                  </h3>
                  <p>
                    {talent
                      ? "The community is growing. Publish your professional profile to help future clients discover what you do best."
                      : "Please try the talent directory again shortly."}
                  </p>
                  <Link href="/profile">
                    Build your profile <ArrowRight size={16} />
                  </Link>
                </div>
              )}
            </div>
            <p className="home-discovery-note">
              A fresh selection of published professionals each day. Explore the directory to find
              your match.
            </p>
          </div>
        </section>
        <section className="public-section public-container" id="how-it-works">
          <div className="public-section-heading">
            <div>
              <p className="public-kicker">From first hello to work well done</p>
              <h2>
                A better working relationship,
                <br />
                one clear step at a time.
              </h2>
            </div>
          </div>
          <div className="home-steps">
            {[
              [
                "Discover",
                "Find opportunities that fit your skills, or professionals who understand your ambition.",
              ],
              [
                "Agree",
                "Turn a conversation into a shared scope, clear milestones, and agreed deliverables.",
              ],
              [
                "Deliver",
                "Share the work with evidence. Review each milestone against what you agreed.",
              ],
              [
                "Build reputation",
                "Let completed engagements and honest reviews become part of your professional story.",
              ],
            ].map(([title, copy], i) => (
              <article key={title}>
                <span>0{i + 1}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="public-container">
          <div className="home-trust">
            <div>
              <p className="public-kicker">
                <ShieldCheck size={17} /> Trust, grounded in work
              </p>
              <h2>
                A reputation you build.
                <br />A story you can stand behind.
              </h2>
              <p>
                Skills and portfolios introduce you. Completed Klaveroq engagements and reviews tell
                the next chapter. Each signal has a clear source.
              </p>
              <Link href="/talent">
                Discover the people behind the work <ArrowRight size={17} />
              </Link>
            </div>
            <ReputationNotes>
              <article>
                <span>01</span>
                <div>
                  <h3>Everyone starts somewhere</h3>
                  <p>
                    New professionals are welcome. No invented ratings or credentials — just space
                    to show what you can do.
                  </p>
                </div>
              </article>
              <article>
                <span>02</span>
                <div>
                  <h3>Proof makes progress visible</h3>
                  <p>
                    Milestones make expectations explicit and give both sides a shared basis for
                    reviewing delivery.
                  </p>
                </div>
              </article>
              <article>
                <span>03</span>
                <div>
                  <h3>Transparent from the start</h3>
                  <p>
                    Community beta supports discovery and work planning. Payments and external
                    credentials are not connected.
                  </p>
                </div>
              </article>
            </ReputationNotes>
          </div>
        </section>
        <section className="public-section public-container home-audiences">
          <article>
            <p className="public-kicker">For professionals</p>
            <h2>
              Your skills deserve
              <br />
              the right opportunity.
            </h2>
            <p>
              Bring your portfolio, find work that fits, and build a track record with every
              completed engagement.
            </p>
            <Link href="/register?returnTo=/profile">
              Join as a professional <ArrowUpRight size={18} />
            </Link>
          </article>
          <article>
            <p className="public-kicker">For clients</p>
            <h2>
              Great work starts
              <br />
              with a clear brief.
            </h2>
            <p>
              Discover independent talent, compare proposals, and agree on exactly what a successful
              delivery looks like.
            </p>
            <Link href="/jobs/new/public">
              Post your first opportunity <ArrowUpRight size={18} />
            </Link>
          </article>
        </section>
        <section className="home-final">
          <div className="public-container">
            <p className="public-kicker">Let’s make good work happen</p>
            <h2>
              Your next chapter
              <br />
              starts with a connection.
            </h2>
            <Link className="primary-button" href="/register">
              Join Klaveroq <ArrowUpRight size={18} />
            </Link>
            <p>Work with trust. Deliver with proof.</p>
          </div>
        </section>
      </main>
      <footer className="home-footer public-container">
        <div>
          <Link className="brand" href="/">
            Klaveroq<span className="footer-dot">.</span>
          </Link>
          <p>A clearer way to work together.</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/jobs">Find work</Link>
          <Link href="/talent">Find talent</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/login">Sign in</Link>
        </nav>
        <small>© {new Date().getUTCFullYear()} Klaveroq · Community beta</small>
      </footer>
    </div>
  );
}
