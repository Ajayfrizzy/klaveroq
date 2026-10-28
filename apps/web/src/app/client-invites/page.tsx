import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/server/auth/session";
import { invitationHistory } from "@/features/client-invites/server/service";
import { InviteWorkspace } from "@/features/client-invites/components/invites";
export default async function ClientInvitesPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login?returnTo=/client-invites");
  const history = await invitationHistory(current.user.id);
  return (
    <AppShell>
      <InviteWorkspace
        history={history.map((invite) => ({
          ...invite,
          expiresAt: invite.expiresAt.toISOString(),
          createdAt: invite.createdAt.toISOString(),
        }))}
      />
    </AppShell>
  );
}
