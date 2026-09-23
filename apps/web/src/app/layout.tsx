import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { RouteTitle } from "@/components/layout/route-title";

export const metadata: Metadata = {
  metadataBase: new URL("https://klaveroq.com"),
  title: { default: "Klaveroq", template: "%s | Klaveroq" },
  description:
    "Klaveroq is a work marketplace where clients discover talent, professionals find opportunities, and both sides structure milestone-based work with verifiable delivery.",
  applicationName: "Klaveroq",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "https://klaveroq.com",
    siteName: "Klaveroq",
    title: "Klaveroq",
    description:
      "Klaveroq is a work marketplace where clients discover talent, professionals find opportunities, and both sides structure milestone-based work with verifiable delivery.",
  },
  twitter: {
    card: "summary",
    title: "Klaveroq",
    description: "Work marketplace for talent discovery and verifiable milestones.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4F46E5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <RouteTitle />
        {children}
      </body>
    </html>
  );
}
