// Public metadata only. Approval and acceptance require a separate reviewed rollout.
export const POLICY_VERSION = "0.1-draft";
export const POLICY_UPDATED = "2026-10-31";
export const POLICY_STATUS = "Draft — not yet effective";
export const policyRegistry = [
  {
    slug: "terms",
    title: "Terms of Service",
    description: "Account responsibilities, marketplace participation and service limitations.",
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    description: "The information we process, why we use it and your privacy choices.",
  },
  {
    slug: "account-deletion",
    title: "Account Deletion & Recovery",
    description: "Account closure, the 30-day recovery window and retained records.",
  },
  {
    slug: "community-guidelines",
    title: "Community Guidelines",
    description: "Standards for honest, respectful work and reporting concerns.",
  },
  {
    slug: "cookies",
    title: "Cookies & Browser Storage",
    description: "Essential sign-in cookies, browser storage and available controls.",
  },
  {
    slug: "payments",
    title: "Payments, Escrow & Refunds",
    description: "What is unavailable in the beta and what must be reviewed before launch.",
  },
] as const;
export type PolicySlug = (typeof policyRegistry)[number]["slug"];
export type PolicySection = {
  id: string;
  title: string;
  paragraphs: string[];
  links?: { label: string; href: string }[];
};
export function findPolicy(slug: string) {
  return policyRegistry.find((policy) => policy.slug === slug);
}
