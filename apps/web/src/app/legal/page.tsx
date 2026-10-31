import Link from "next/link";
import {
  policyRegistry,
  POLICY_STATUS,
  POLICY_UPDATED,
  POLICY_VERSION,
} from "@/features/legal/registry";
import { legalMetadata } from "@/features/legal/metadata";
export const metadata = legalMetadata(
  "Legal & policies",
  "Draft policies explaining Klaveroq’s community beta, privacy choices and account controls.",
  "/legal",
);
export default function LegalHub() {
  return (
    <>
      <header className="legal-intro">
        <p className="eyebrow">Community beta · Transparency</p>
        <h1>Legal & policies</h1>
        <p>
          Understand how Klaveroq works, what the beta can offer and how to manage your information.
        </p>
      </header>
      <aside className="legal-notice" aria-label="Draft status">
        <strong>{POLICY_STATUS}</strong>
        <p>
          These documents require operator and qualified legal review before formal publication or
          acceptance. They do not introduce new mandatory consent or replace your rights under
          applicable law.
        </p>
        <p>
          Version {POLICY_VERSION} · Last updated{" "}
          <time dateTime={POLICY_UPDATED}>31 October 2026</time> · No effective date set
        </p>
      </aside>
      <nav className="legal-grid" aria-label="Policy documents">
        {policyRegistry.map((policy) => (
          <Link className="legal-card" key={policy.slug} href={`/legal/${policy.slug}`}>
            <span className="legal-status">Draft · {POLICY_VERSION}</span>
            <h2>{policy.title}</h2>
            <p>{policy.description}</p>
            <span className="legal-read">Read draft →</span>
          </Link>
        ))}
      </nav>
      <section className="legal-help">
        <h2>Need help with your account or information?</h2>
        <p>You can submit a privacy or account-support request without signing in.</p>
        <Link href="/account/privacy">Privacy and account support</Link>
      </section>
    </>
  );
}
