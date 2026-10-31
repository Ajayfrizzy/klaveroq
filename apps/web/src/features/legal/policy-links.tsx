import Link from "next/link";
import { policyRegistry, type PolicySlug } from "./registry";
export function PolicyLinks({
  slugs,
  label = "Policy drafts",
}: {
  slugs: PolicySlug[];
  label?: string;
}) {
  return (
    <nav className="policy-links" aria-label={label}>
      {slugs.map((slug) => {
        const policy = policyRegistry.find((item) => item.slug === slug)!;
        return (
          <Link key={slug} href={`/legal/${slug}`}>
            {policy.title} (draft)
          </Link>
        );
      })}
    </nav>
  );
}
