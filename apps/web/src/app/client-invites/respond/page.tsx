import Link from "next/link";
import { getCurrentUser } from "@/server/auth/session";
import { invitationPreview } from "@/features/client-invites/server/service";
import { InvitationResponse } from "@/features/client-invites/components/invites";
export const metadata = {
  title: "Client invitation | Klaveroq",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function InvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const current = await getCurrentUser();
  const returnTo = encodeURIComponent(
    `/client-invites/respond?token=${encodeURIComponent(token.slice(0, 100))}`,
  );
  if (!current)
    return (
      <main className="client-invites invite-landing">
        <section className="panel invite-panel">
          <p className="eyebrow">Klaveroq · Work with trust</p>
          <h1>You’re invited to collaborate</h1>
          <p>
            Sign in or register with the email address that received this invitation. Review the
            details before you decide.
          </p>
          <div className="invite-actions">
            <Link className="primary-button" href={`/register?returnTo=${returnTo}`}>
              Create account
            </Link>
            <Link className="secondary-button" href={`/login?returnTo=${returnTo}`}>
              Sign in
            </Link>
          </div>
        </section>
      </main>
    );
  const invite = current.user.emailVerifiedAt
    ? await invitationPreview(token, current.user.email)
    : null;
  return (
    <main className="client-invites invite-landing">
      {invite ? (
        <InvitationResponse token={token} invite={invite} />
      ) : (
        <section className="panel invite-panel">
          <h1>Invitation unavailable</h1>
          <p>
            Use the verified email address that received this invitation, or ask your freelancer for
            a new link.
          </p>
          <Link href={`/login?returnTo=${returnTo}`}>Sign in with another account</Link>
          <p>
            <Link href={`/verify-email?returnTo=${returnTo}`}>Verify your email</Link>
          </p>
          <Link href="/dashboard">Go to dashboard</Link>
        </section>
      )}
    </main>
  );
}
