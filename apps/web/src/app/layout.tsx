import { connection } from "next/server";
import { fileUploadsEnabled } from "@/features/files/upload-policy";
import { UploadAvailabilityProvider } from "@/features/files/upload-availability";
import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import "@/styles/product-experience.css";
import "@/styles/public-marketplace.css";
import { RouteTitle } from "@/components/layout/route-title";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: { default: "Klaveroq", template: "%s | Klaveroq" },
  description:
    "Klaveroq is a work marketplace where clients discover talent, professionals find opportunities, and both sides structure milestone-based work with verifiable delivery.",
  applicationName: "Klaveroq",
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",

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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <RouteTitle />
        <div id="main-content" tabIndex={-1}>
          <UploadAvailabilityProvider enabled={fileUploadsEnabled()}>
            {children}
          </UploadAvailabilityProvider>
        </div>
      </body>
    </html>
  );
}
