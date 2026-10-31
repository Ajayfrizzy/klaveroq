import Link from "next/link";
import { notFound } from "next/navigation";
import {
  findPolicy,
  POLICY_STATUS,
  POLICY_UPDATED,
  POLICY_VERSION,
} from "@/features/legal/registry";
import { policyDocuments } from "@/features/legal/documents";
import { legalMetadata } from "@/features/legal/metadata";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const policy = findPolicy((await params).slug);
  if (!policy) notFound();
  return legalMetadata(policy.title, policy.description, `/legal/${policy.slug}`);
}
export default async function PolicyPage({ params }: Props) {
  const policy = findPolicy((await params).slug);
  if (!policy) notFound();
  const sections = policyDocuments[policy.slug];
  return (
    <>
      <Link className="legal-back" href="/legal">
        ← All policies
      </Link>
      <header className="legal-intro">
        <p className="eyebrow">Community beta · Policy draft</p>
        <h1>{policy.title}</h1>
        <p>{policy.description}</p>
      </header>
      <aside className="legal-notice" aria-label="Draft status">
        <strong>{POLICY_STATUS}</strong>
        <p>
          For operator and qualified legal review before formal publication or acceptance. No
          effective date has been set.
        </p>
        <p>
          Version {POLICY_VERSION} · Last updated{" "}
          <time dateTime={POLICY_UPDATED}>31 October 2026</time>
        </p>
      </aside>
      <div className="legal-document">
        <nav className="legal-toc" aria-label="On this page">
          <h2>On this page</h2>
          <ol>
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title.replace(/^\d+\. /, "")}</a>
              </li>
            ))}
          </ol>
        </nav>
        <article aria-label={policy.title}>
          {sections.map((section) => (
            <section key={section.id} aria-labelledby={section.id}>
              <h2 id={section.id} tabIndex={-1}>
                {section.title}
              </h2>
              {section.paragraphs.map((text) => (
                <p key={text}>{text}</p>
              ))}
              {section.links && (
                <ul className="legal-related">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          <Link href="/legal">Back to all policy drafts</Link>
        </article>
      </div>
    </>
  );
}
