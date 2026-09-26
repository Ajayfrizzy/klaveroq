import { Bell, BriefcaseBusiness, House, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/server/auth/session";
import { PublicNavigation } from "./public-navigation";

export async function MarketplaceHeader() {
  const current = await getCurrentUser();
  return (
    <header className="market-header">
      <Link className="brand" href="/" aria-label="Klaveroq dashboard">
        <span className="brand-mark">
          <ShieldCheck size={20} />
        </span>
        <span>Klaveroq</span>
      </Link>
      {!current ? (
        <PublicNavigation />
      ) : (
        <nav>
          {current && (
            <Link className="market-dashboard-link" href="/">
              <House size={16} /> Dashboard
            </Link>
          )}
          <Link className="market-discover-link" href="/discover">
            <BriefcaseBusiness size={16} /> Find work
          </Link>
          <Link className="market-talent-link" href="/talent">
            <UsersRound size={16} /> Find talent
          </Link>
          {current ? (
            <>
              <Link className="market-jobs-link" href="/jobs">
                My jobs
              </Link>
              <Link className="market-icon-link" href="/notifications" aria-label="Notifications">
                <Bell size={17} />
              </Link>
              <Link className="market-account-link" href="/profile">
                <span>
                  {(current.profile?.displayName || current.user.email)
                    .split(/\s+|@/)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <UserRound size={15} /> Profile
              </Link>
              <Link className="primary-button" href="/jobs/new/public">
                Post a job
              </Link>
            </>
          ) : (
            <>
              <Link className="market-signin-link" href="/login?returnTo=/discover">
                Sign in
              </Link>
              <Link className="primary-button" href="/register">
                Create account
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
