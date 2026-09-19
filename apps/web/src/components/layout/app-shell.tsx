"use client";

import {
  Activity,
  Bell,
  Compass,
  BriefcaseBusiness,
  CircleHelp,
  CreditCard,
  House,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LogoutButton } from "@/components/ui/logout-button";

const primary = [
  { label: "Overview", href: "/", icon: House },
  { label: "Find work", href: "/discover", icon: Compass },
  { label: "Find talent", href: "/talent", icon: UsersRound },
  { label: "Jobs", href: "/jobs", icon: BriefcaseBusiness },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Activity", href: "/activity", icon: Activity },
];

const secondary = [
  { label: "Wallet & security", href: "/wallet", icon: WalletCards },
  { label: "Profile", href: "/profile", icon: UserRound },
  { label: "Support", href: "/support", icon: CircleHelp },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [account, setAccount] = useState<{ displayName: string; email: string } | null>(null);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  const refreshUnreadNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/unread", { cache: "no-store" });
      if (!response.ok) return;
      const body = await response.json();
      setHasUnreadNotifications(Boolean(body.data?.hasUnread));
    } catch {
      // Keep the indicator unobtrusive if notification state cannot be refreshed.
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/me")
      .then((response) => response.json())
      .then((body) => {
        if (active && body.data)
          setAccount({
            displayName: body.data.profile?.displayName || body.data.user.email.split("@")[0],
            email: body.data.user.email,
          });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshUnreadNotifications(), 0);
    return () => window.clearTimeout(timer);
  }, [pathname, refreshUnreadNotifications]);

  useEffect(() => {
    const refresh = () => void refreshUnreadNotifications();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("notifications:changed", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("notifications:changed", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshUnreadNotifications]);

  const initials =
    account?.displayName
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "VR";

  const nav = (items: typeof primary) =>
    items.map(({ label, href, icon: Icon }) => {
      const active = pathname === href;
      return (
        <Link
          className={`nav-link ${active ? "active" : ""}`}
          href={href}
          key={href}
          onClick={() => setMenuOpen(false)}
        >
          <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
          <span>{label}</span>
        </Link>
      );
    });

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand-row">
          <Link className="brand" href="/" aria-label="Klaveroq home">
            <span className="brand-mark">
              <ShieldCheck size={20} strokeWidth={2.2} />
            </span>
            <span>Klaveroq</span>
          </Link>
          <button
            className="icon-button sidebar-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <Link className="create-button" href="/jobs/new" onClick={() => setMenuOpen(false)}>
          <Plus size={18} /> Create job
        </Link>
        <p className="nav-group-label">Workspace</p>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {nav(primary)}
        </nav>
        <p className="nav-group-label account-label">Account</p>
        <nav className="sidebar-nav secondary" aria-label="Account navigation">
          {nav(secondary)}
        </nav>
        <div className="network-card">
          <div>
            <span className="status-dot" /> Systems operational
          </div>
          <p>CKB Mainnet · PactAgent</p>
        </div>
        <div className="sidebar-user">
          <span className="avatar">{initials}</span>
          <span>
            <strong>{account?.displayName || "Klaveroq account"}</strong>
            <small>{account?.email || "Signed in"}</small>
          </span>
          <span className="sidebar-user-actions">
            <Link href="/wallet" aria-label="Open account settings" title="Settings">
              <Settings size={17} />
            </Link>
            <LogoutButton compact />
          </span>
        </div>
      </aside>
      {menuOpen && (
        <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Close menu" />
      )}

      <div className="main-column">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={21} />
          </button>
          <Link className="mobile-brand" href="/">
            <span className="brand-mark">
              <ShieldCheck size={18} />
            </span>
            Klaveroq
          </Link>
          {pathname !== "/" && (
            <Link className="dashboard-return" href="/">
              <House size={16} />
              <span>Dashboard</span>
            </Link>
          )}
          <div className="topbar-actions">
            <Link
              className="icon-button"
              href="/notifications"
              aria-label={hasUnreadNotifications ? "Notifications, unread items" : "Notifications"}
            >
              <Bell size={19} />
              {hasUnreadNotifications && <span className="notification-dot" aria-hidden="true" />}
            </Link>
            <Link className="top-avatar" href="/profile" aria-label="Open profile">
              {initials}
            </Link>
          </div>
        </header>
        <main className="page-content">{children}</main>
        <nav className="bottom-nav" aria-label="Mobile navigation">
          {primary.slice(0, 4).map(({ label, href, icon: Icon }) => (
            <Link className={pathname === href ? "active" : ""} href={href} key={href}>
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
          <Link className={pathname === "/profile" ? "active" : ""} href="/profile">
            <UserRound size={20} />
            <span>Profile</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
