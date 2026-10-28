import type { MetadataRoute } from "next";
// The community beta is publicly browsable, but not yet intended for indexing.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
