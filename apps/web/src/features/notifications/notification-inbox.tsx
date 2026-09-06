"use client";
import { Bell, CheckCheck, Settings2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
type Notification = {
  id: string;
  title: string;
  body: string;
  href?: string;
  readAt?: string;
  createdAt: string;
};
export function NotificationInbox() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications");
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error?.message ?? "Notifications could not be loaded.");
      setItems(body.data);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Notifications could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function readAll() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/notifications/read", { method: "POST" });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error?.message ?? "Notifications could not be marked as read.");
      }
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Notifications could not be marked as read.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Updates that require attention across jobs, payments, security, and support."
        icon={Bell}
        action={
          <div className="header-actions">
            <button className="secondary-button" onClick={readAll} disabled={busy || !items.length}>
              <CheckCheck size={16} /> {busy ? "Updating..." : "Mark all read"}
            </button>
            <button className="icon-button bordered" aria-label="Notification settings">
              <Settings2 size={17} />
            </button>
          </div>
        }
      />
      <section className="panel notifications-list">
        {error && (
          <p className="form-feedback error" role="alert">
            {error} Try refreshing the page.
          </p>
        )}
        {loading && (
          <div className="notification-loading" aria-label="Loading notifications">
            <i />
            <i />
            <i />
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="market-empty compact-empty">
            <CheckCheck size={25} />
            <h2>You are all caught up</h2>
            <p>New marketplace updates will appear here.</p>
          </div>
        )}
        {items.map((item) => {
          const content = (
            <>
              <span className="notification-icon">
                <Bell size={17} />
              </span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <small>{new Date(item.createdAt).toLocaleString()}</small>
              </div>
              {!item.readAt && <span className="unread-dot" />}
            </>
          );
          return item.href ? (
            <Link className={item.readAt ? "" : "unread"} href={item.href} key={item.id}>
              {content}
            </Link>
          ) : (
            <article className={item.readAt ? "" : "unread"} key={item.id}>
              {content}
            </article>
          );
        })}
      </section>
    </>
  );
}
