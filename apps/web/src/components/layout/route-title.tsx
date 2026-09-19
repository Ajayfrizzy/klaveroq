"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const exactTitles: Record<string, string> = {
  "/": "Dashboard",
  "/activity": "Activity",
  "/discover": "Find Work",
  "/talent": "Find Talent",
  "/jobs": "Jobs",
  "/jobs/new": "Create Job",
  "/jobs/new/direct": "Direct Invitation",
  "/jobs/new/public": "Post a Public Job",
  "/login": "Sign In",
  "/notifications": "Notifications",
  "/payments": "Payments",
  "/profile": "Profile",
  "/register": "Create Account",
  "/support": "Support",
  "/wallet": "Wallet & Security",
  "/admin": "Admin Dashboard",
  "/admin/login": "Admin Sign In",
  "/admin/support": "Support Queue",
};

function pageTitle(pathname: string) {
  if (exactTitles[pathname]) return exactTitles[pathname];
  if (/^\/discover\/[^/]+$/.test(pathname)) return "Job Listing";
  if (/^\/talent\/[^/]+$/.test(pathname)) return "Professional Profile";
  if (/^\/jobs\/[^/]+$/.test(pathname)) return "Job Details";
  if (/^\/support\/[^/]+$/.test(pathname)) return "Support Case";
  if (/^\/admin\/support\/[^/]+$/.test(pathname)) return "Support Ticket";
  return "Klaveroq";
}

export function RouteTitle() {
  const pathname = usePathname();
  useEffect(() => {
    document.title = `${pageTitle(pathname)} | Klaveroq`;
  }, [pathname]);
  return null;
}
