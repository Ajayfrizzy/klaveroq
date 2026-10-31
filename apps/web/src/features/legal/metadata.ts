import type { Metadata } from "next";
export function legalMetadata(title: string, description: string, path: string): Metadata {
  const draftTitle = `${title} — Draft`;
  return {
    title: draftTitle,
    description,
    alternates: { canonical: path },
    robots: { index: false, follow: false },
    openGraph: { title: draftTitle, description, url: path, type: "website", siteName: "Klaveroq" },
    twitter: { card: "summary", title: draftTitle, description },
  };
}
