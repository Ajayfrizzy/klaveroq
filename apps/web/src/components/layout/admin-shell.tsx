import { Bell, Headphones, LayoutDashboard, Scale, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/server/auth/session";
import { LogoutButton } from "@/components/ui/logout-button";

export async function AdminShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active: "dashboard" | "support" | "disputes";
}) {
  const current = await getCurrentUser();
  const name = current?.profile?.displayName ?? "Support administrator";
  const role = current?.user.systemRole;
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
          {["SUPPORT", "SUPER_ADMIN"].includes(role ?? "") && (
            <>
              <Link
                aria-current={active === "dashboard" ? "page" : undefined}
                className={active === "dashboard" ? "active" : ""}
                href="/admin"
              >
                <LayoutDashboard size={18} /> Overview
              </Link>
              <Link
                aria-current={active === "support" ? "page" : undefined}
                className={active === "support" ? "active" : ""}
                href="/admin/support"
              >
                <Headphones size={18} /> Support queue
              </Link>
            </>
          )}
          {["DISPUTE_ADMIN", "SUPER_ADMIN"].includes(role ?? "") && (
            <Link
              aria-current={active === "disputes" ? "page" : undefined}
              className={active === "disputes" ? "active" : ""}
              href="/admin/disputes"
            >
              <Scale size={18} /> Disputes
            </Link>
          )}
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
            <span>Restricted operational administration</span>
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
