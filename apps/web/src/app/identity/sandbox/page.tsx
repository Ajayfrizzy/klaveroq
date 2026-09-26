import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SandboxIdentityForm } from "@/features/identity/components/sandbox-identity-form";
import { getCurrentUser } from "@/server/auth/session";
import { allowsIdentitySandbox } from "@/server/deployment";

export default async function IdentitySandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ verificationId?: string }>;
}) {
  if (!allowsIdentitySandbox()) notFound();
  const current = await getCurrentUser();
  if (!current) redirect("/login?returnTo=%2Fidentity");
  const { verificationId } = await searchParams;
  if (!verificationId) redirect("/identity");
  return (
    <AppShell>
      <SandboxIdentityForm verificationId={verificationId} />
    </AppShell>
  );
}
