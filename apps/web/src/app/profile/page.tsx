import { BadgeCheck, BriefcaseBusiness, Star, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileEditor } from "@/features/talent/components/profile-editor";
import { getReputationSummary } from "@/features/reputation/server/queries";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { portfolioItems } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const current = await getCurrentUser();
  if (!current?.profile) redirect("/login?returnTo=/profile");
  const [portfolio, reputation] = await Promise.all([
    db
      .select()
      .from(portfolioItems)
      .where(eq(portfolioItems.userId, current.user.id))
      .orderBy(desc(portfolioItems.createdAt)),
    getReputationSummary(current.user.id),
  ]);
  return (
    <AppShell>
      <PageHeader
        eyebrow="Professional identity"
        title="Profile and portfolio"
        description="Manage the public experience clients use to evaluate your work on Klaveroq."
        icon={UserRound}
      />
      <div className="profile-layout">
        <ProfileEditor initialProfile={current.profile} initialPortfolio={portfolio} />
        <aside>
          <section className="panel reputation-card">
            <h2>Verified Klaveroq reputation</h2>
            <div className="reputation-score">
              <Star size={22} fill={reputation.averageRating ? "currentColor" : "none"} />
              <strong>{reputation.averageRating?.toFixed(1) ?? "New"}</strong>
              <span>
                {reputation.reviewCount
                  ? `${reputation.reviewCount} verified ${reputation.reviewCount === 1 ? "review" : "reviews"}`
                  : "No verified reviews yet"}
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
          </section>
          <section className="panel role-summary">
            {reputation.identityVerified ? (
              <BadgeCheck size={20} />
            ) : (
              <BriefcaseBusiness size={20} />
            )}
            <h2>
              {reputation.identityVerified
                ? "Identity verified"
                : "Professional marketplace profile"}
            </h2>
            <p>
              Reputation shown here comes only from completed Klaveroq engagements and released
              milestones.
            </p>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
