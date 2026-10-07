import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/server/auth/session";
import { PublicNavigation } from "./public-navigation";

export async function MarketplaceHeader() {
  const current = await getCurrentUser();
  return (
    <header className="market-header">
      <Link className="brand" href="/" aria-label="Klaveroq home">
        <span className="brand-mark">
          <ShieldCheck size={20} />
        </span>
        <span>Klaveroq</span>
      </Link>
      <PublicNavigation signedIn={Boolean(current)} />
    </header>
  );
}
