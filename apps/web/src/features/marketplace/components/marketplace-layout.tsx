import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/server/auth/session";
import { MarketplaceHeader } from "./marketplace-header";

export async function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentUser();
  if (current)
    return (
      <AppShell>
        <div className="market-content">{children}</div>
      </AppShell>
    );
  return (
    <div className="market-page">
      <MarketplaceHeader />
      <main>{children}</main>
    </div>
  );
}
