import { Bell, Headphones, LayoutDashboard, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/server/auth/session";
import { LogoutButton } from "@/components/ui/logout-button";

export async function AdminShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active: "dashboard" | "support";
}) {
  const current = await getCurrentUser();
  const name = current?.profile?.displayName ?? "Support administrator";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin">
          <span>
            <ShieldCheck size={20} />
          </span>
          <div>
            <strong>Klaveroq</strong>
            <small>Operations</small>
          </div>
        </Link>
        <p>Workspace</p>
        <nav>
          <Link className={active === "dashboard" ? "active" : ""} href="/admin">
            <LayoutDashboard size={18} /> Overview
          </Link>
          <Link className={active === "support" ? "active" : ""} href="/admin/support">
            <Headphones size={18} /> Support queue
          </Link>
        </nav>
        <div className="admin-operator">
          <span>{initials}</span>
          <div>
            <strong>{name}</strong>
            <small>{current?.user.systemRole.toLowerCase().replaceAll("_", " ")}</small>
          </div>
        </div>
        <LogoutButton admin compact />
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <strong>Operations console</strong>
            <span>Support and account administration</span>
          </div>
          <Link href="/notifications" aria-label="Admin notifications">
            <Bell size={18} />
          </Link>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
