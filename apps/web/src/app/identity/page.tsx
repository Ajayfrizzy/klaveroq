import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { IdentityPanel } from "@/features/identity/components/identity-panel";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { identityVerifications, vellumIdentityBindings, wallets } from "@/server/db/schema";
import { ShieldCheck } from "lucide-react";
import { identityAvailability } from "@/server/identity/provider";
import { VellumIdentityPanel } from "@/features/vellum/components/vellum-identity-panel";

export const dynamic = "force-dynamic";

export default async function IdentityPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login?returnTo=%2Fidentity");
  const [identityRows, bindingRows, verifiedWalletRows] = await Promise.all([
    db
      .select()
      .from(identityVerifications)
      .where(eq(identityVerifications.userId, current.user.id))
      .orderBy(desc(identityVerifications.createdAt))
      .limit(1),
    db
      .select()
      .from(vellumIdentityBindings)
      .where(eq(vellumIdentityBindings.userId, current.user.id))
      .limit(1),
    db
      .select({ id: wallets.id })
      .from(wallets)
      .where(
        and(
          eq(wallets.userId, current.user.id),
          eq(wallets.status, "VERIFIED"),
          eq(wallets.network, "testnet"),
        ),
      )
      .limit(1),
  ]);
  const record = identityRows[0];
  const binding = bindingRows[0];
  return (
    <AppShell>
      <PageHeader
        eyebrow="Account trust"
        title="Identity"
        description="Manage identity records connected to your Klaveroq account."
        icon={ShieldCheck}
      />
      <div className="identity-page-panels">
        <VellumIdentityPanel
          binding={binding ?? null}
          hasVerifiedTestnetWallet={verifiedWalletRows.length > 0}
        />
        <IdentityPanel
          record={record ?? { status: "NOT_STARTED" }}
          availability={identityAvailability()}
        />
      </div>
    </AppShell>
  );
}
