"use client";
import { DevicePreferenceImport } from "@/features/preferences/client";

import {
  Activity,
  Bell,
  Compass,
  BriefcaseBusiness,
  CircleHelp,
  ChevronUp,
  CreditCard,
  House,
  Menu,
  Plus,
  ShieldCheck,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogoutButton } from "@/components/ui/logout-button";

const primary = [
  { label: "Overview", href: "/dashboard", icon: House },
  { label: "Find work", href: "/discover", icon: Compass },
  { label: "Find talent", href: "/talent", icon: UsersRound },
  { label: "Jobs", href: "/jobs?view=agreements", icon: BriefcaseBusiness },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Activity", href: "/activity", icon: Activity },
];

const secondary = [
  { label: "Wallet & security", href: "/wallet", icon: WalletCards },
  { label: "Profile", href: "/profile", icon: UserRound },
  { label: "Support", href: "/support", icon: CircleHelp },
];

const matchesPath = (pathname: string, href: string) =>
  href === "/"
    ? pathname === href
    : pathname === href.split("?")[0] || pathname.startsWith(`${href.split("?")[0]}/`);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!accountOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const dismissWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setAccountOpen(false);
      accountButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismissWithEscape, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismissWithEscape, true);
    };
  }, [accountOpen]);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const sidebar = sidebarRef.current;
    const menuButton = menuButtonRef.current;
    const controls = () =>
      Array.from(sidebar?.querySelectorAll<HTMLElement>("a, button") ?? []).filter(
        (element) => element.getClientRects().length > 0,
      );
    controls()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      menuButton?.focus();
    };
  }, [menuOpen]);
  const [account, setAccount] = useState<{ id: string; displayName: string; email: string } | null>(
    null,
  );
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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
        if (active)
          setAvatarUrl(
            body.data?.profile?.avatarKey
              ? `/api/media/avatar/${body.data.user.id}?v=${encodeURIComponent(body.data.profile.avatarKey)}`
              : null,
          );
        if (active && body.data)
          setAccount({
            id: body.data.user.id,
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
    const update = (event: Event) => setAvatarUrl((event as CustomEvent<string | null>).detail);
    window.addEventListener("profile:avatar-changed", update);
    return () => window.removeEventListener("profile:avatar-changed", update);
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
      const active = matchesPath(pathname, href);
      return (
        <Link
          aria-current={active ? "page" : undefined}
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
      <aside
        ref={sidebarRef}
        className={`sidebar ${menuOpen ? "open" : ""}`}
        id="app-sidebar"
        aria-label="Workspace menu"
      >
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
          <Plus size={18} /> Hire someone
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
            <span className="status-dot" /> Marketplace available
          </div>
          <p>Payment network not connected</p>
        </div>
        <div
          className="sidebar-account"
          ref={accountRef}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              setAccountOpen(false);
          }}
        >
          <button
            type="button"
            className="sidebar-user account-trigger"
            ref={accountButtonRef}
            aria-label="Account options"
            aria-expanded={accountOpen}
            aria-controls="account-options"
            onClick={() => setAccountOpen((open) => !open)}
          >
            <span className="avatar">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" onError={() => setAvatarUrl(null)} />
              ) : (
                initials
              )}
            </span>
            <span>
              <strong>{account?.displayName || "Klaveroq account"}</strong>
              <small>{account?.email || "Signed in"}</small>
            </span>
            <ChevronUp size={16} className="account-chevron" aria-hidden="true" />
          </button>
          {accountOpen && (
            <nav
              id="account-options"
              className="account-options"
              aria-label="Account options"
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("a")) {
                  setAccountOpen(false);
                  setMenuOpen(false);
                }
              }}
            >
              <Link href="/profile">
                <UserRound size={17} /> View profile
              </Link>
              <Link href="/wallet">
                <ShieldCheck size={17} /> Wallet &amp; security
              </Link>
              <Link
                href="/notifications#preferences"
                onClick={() => window.dispatchEvent(new Event("notifications:open-preferences"))}
              >
                <Bell size={17} /> Notification preferences
              </Link>
              <div className="account-signout">
                <LogoutButton compact label="Sign out" />
              </div>
            </nav>
          )}
        </div>
      </aside>
      {menuOpen && (
        <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Close menu" />
      )}

      <div className="main-column" inert={menuOpen ? true : undefined}>
        <header className="topbar">
          <button
            ref={menuButtonRef}
            aria-controls="app-sidebar"
            aria-expanded={menuOpen}
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
          {pathname !== "/dashboard" && (
            <Link className="dashboard-return" href="/dashboard" aria-label="Dashboard">
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
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" onError={() => setAvatarUrl(null)} />
              ) : (
                initials
              )}
            </Link>
          </div>
        </header>
        <main className="page-content">
          {account && <DevicePreferenceImport key={account.id} userId={account.id} />}
          {children}
        </main>
        <nav className="bottom-nav" aria-label="Mobile navigation">
          {primary.slice(0, 4).map(({ label, href, icon: Icon }) => (
            <Link
              aria-current={matchesPath(pathname, href) ? "page" : undefined}
              className={matchesPath(pathname, href) ? "active" : ""}
              href={href}
              key={href}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
          <Link
            aria-current={matchesPath(pathname, "/profile") ? "page" : undefined}
            className={matchesPath(pathname, "/profile") ? "active" : ""}
            href="/profile"
          >
            <UserRound size={20} />
            <span>Profile</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
