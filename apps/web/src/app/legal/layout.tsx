import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PublicFooter } from "@/features/marketplace/components/public-footer";
import "@/styles/legal.css";
// Deliberately independent of account/database reads: notices stay public even with a stale session.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-site legal-site">
      <header className="market-header legal-header">
        <Link className="brand" href="/" aria-label="Klaveroq home">
          <span className="brand-mark">
            <ShieldCheck size={20} />
          </span>
          <span>Klaveroq</span>
        </Link>
        <nav aria-label="Legal navigation">
          <Link href="/legal">Legal & policies</Link>
          <Link href="/account/privacy">Privacy help</Link>
        </nav>
      </header>
      <main className="public-container legal-main">{children}</main>
      <PublicFooter />
    </div>
  );
}
