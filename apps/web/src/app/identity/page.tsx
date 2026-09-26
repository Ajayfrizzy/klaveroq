import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { IdentityPanel } from "@/features/identity/components/identity-panel";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { identityVerifications } from "@/server/db/schema";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function IdentityPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login?returnTo=%2Fidentity");
  const [record] = await db
    .select()
    .from(identityVerifications)
    .where(eq(identityVerifications.userId, current.user.id))
    .orderBy(desc(identityVerifications.createdAt))
    .limit(1);
  return (
    <AppShell>
      <PageHeader
        eyebrow="Account trust"
        title="Identity verification"
        description="Review the status returned by the configured identity provider."
        icon={ShieldCheck}
      />
      <IdentityPanel record={record ?? { status: "NOT_STARTED" }} />
    </AppShell>
  );
}
