import { invitationAgreement } from "@/features/client-invites/server/service";
import { db } from "@/server/db";
import { profiles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { JobWizard } from "@/features/jobs/components/job-wizard";
import { getCurrentUser } from "@/server/auth/session";
import { getPublicTalent } from "@/features/talent/server/queries";

export default async function DirectJobPage({
  searchParams,
}: {
  searchParams: Promise<{ talent?: string; invitation?: string }>;
}) {
  const { talent: talentId, invitation: invitationId } = await searchParams;
  const current = await getCurrentUser();
  if (!current)
    redirect(
      `/login?returnTo=${encodeURIComponent(`/jobs/new/direct${invitationId ? `?invitation=${encodeURIComponent(invitationId)}` : talentId ? `?talent=${talentId}` : ""}`)}`,
    );
  if (invitationId) {
    const invite = await invitationAgreement(
      z.string().uuid().parse(invitationId),
      current.user.id,
    );
    if (invite.jobId) redirect(`/jobs/${invite.jobId}`);
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, invite.ownerUserId));
    return (
      <AppShell>
        <JobWizard
          clientInviteId={invite.id}
          initialTitle={invite.projectTitle}
          selectedTalent={{
            userId: invite.ownerUserId,
            displayName: profile?.displayName ?? "Your freelancer",
            skills: [],
            identityVerified: false,
          }}
        />
      </AppShell>
    );
  }
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
