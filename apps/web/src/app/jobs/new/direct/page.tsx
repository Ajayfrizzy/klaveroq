import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { JobWizard } from "@/features/jobs/components/job-wizard";
import { getCurrentUser } from "@/server/auth/session";
import { getPublicTalent } from "@/features/talent/server/queries";

export default async function DirectJobPage({
  searchParams,
}: {
  searchParams: Promise<{ talent?: string }>;
}) {
  const { talent: talentId } = await searchParams;
  const current = await getCurrentUser();
  if (!current)
    redirect(
      `/login?returnTo=${encodeURIComponent(`/jobs/new/direct${talentId ? `?talent=${talentId}` : ""}`)}`,
    );
  const talent = talentId && talentId !== current?.user.id ? await getPublicTalent(talentId) : null;
  const selectedTalent =
    talent && talent.profile.availability !== "UNAVAILABLE"
      ? {
          userId: talent.profile.userId,
          displayName: talent.profile.displayName,
          headline: talent.profile.headline,
          primaryRole: talent.profile.primaryRole,
          skills: talent.profile.skills.slice(0, 5),
          identityVerified: talent.reputation.identityVerified,
        }
      : undefined;
  return (
    <AppShell>
      <JobWizard selectedTalent={selectedTalent} />
    </AppShell>
  );
}
