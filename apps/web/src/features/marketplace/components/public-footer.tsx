import Link from "next/link";
import { policyRegistry } from "@/features/legal/registry";
export function PublicFooter() {
  return (
    <footer className="home-footer public-container">
      <div>
        <Link className="brand" href="/">
          Klaveroq<span className="footer-dot">.</span>
        </Link>
        <p>A clearer way to work together.</p>
      </div>
      <nav aria-label="Footer navigation">
        <Link href="/jobs">Find work</Link>
        <Link href="/talent">Find talent</Link>
        <Link href="/#how-it-works">How it works</Link>
        <Link href="/login">Sign in</Link>
      </nav>
      <nav className="footer-policies" aria-label="Legal and policy drafts">
        <Link href="/legal">Legal & policies</Link>
        {policyRegistry.map((policy) => (
          <Link key={policy.slug} href={`/legal/${policy.slug}`}>
            {policy.title}
          </Link>
        ))}
      </nav>
      <small>
        © {new Date().getUTCFullYear()} Klaveroq · Community beta · Policies are drafts for review
      </small>
    </footer>
  );
}
