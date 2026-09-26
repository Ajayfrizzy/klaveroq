"use client";
import { Bell, Check, CheckCheck, Mail, Settings2 } from "lucide-react";
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
type Preferences = {
  proposalEmails: boolean;
  messageEmails: boolean;
  jobEmails: boolean;
  disputeEmails: boolean;
  supportEmails: boolean;
};
const preferenceLabels: Array<[keyof Preferences, string]> = [
  ["proposalEmails", "Proposal updates"],
  ["messageEmails", "Proposal messages"],
  ["jobEmails", "Job invitations and awards"],
  ["disputeEmails", "Dispute updates"],
  ["supportEmails", "Support replies"],
];
export function NotificationInbox() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
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
      window.dispatchEvent(new Event("notifications:changed"));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Notifications could not be marked as read.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function setRead(id: string, read: boolean) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, readAt: read ? new Date().toISOString() : undefined } : item,
      ),
    );
    const response = await fetch(`/api/notifications/${id}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read }),
      keepalive: true,
    });
    if (!response.ok) await load();
    window.dispatchEvent(new Event("notifications:changed"));
  }
  async function openSettings() {
    const next = !showSettings;
    setShowSettings(next);
    if (!next || preferences) return;
    const response = await fetch("/api/notifications/preferences");
    const body = await response.json();
    if (response.ok) setPreferences(body.data);
    else setError(body.error?.message ?? "Notification preferences could not be loaded.");
  }
  async function savePreferences(next: Preferences) {
    setPreferences(next);
    const response = await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error?.message ?? "Notification preferences could not be saved.");
      setPreferences(null);
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
            <button
              className="secondary-button"
              onClick={readAll}
              disabled={busy || !items.some((item) => !item.readAt)}
            >
              <CheckCheck size={16} /> {busy ? "Updating..." : "Mark all read"}
            </button>
            <button
              className="icon-button bordered"
              aria-label="Notification preferences"
              aria-expanded={showSettings}
              title="Notification preferences"
              onClick={openSettings}
            >
              <Settings2 size={17} />
            </button>
          </div>
        }
      />
      {showSettings && (
        <section className="panel notification-preferences" aria-label="Email preferences">
          <div>
            <Mail size={18} />
            <span>
              <strong>Email preferences</strong>
              <small>Security and account-protection messages are always delivered.</small>
            </span>
          </div>
          {preferences ? (
            <div className="preference-options">
              {preferenceLabels.map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={preferences[key]}
                    onChange={(event) =>
                      void savePreferences({ ...preferences, [key]: event.target.checked })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          ) : (
            <p>Loading preferences...</p>
          )}
        </section>
      )}
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
          const message = (
            <>
              <span className="notification-icon">
                <Bell size={17} />
              </span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <small>{new Date(item.createdAt).toLocaleString()}</small>
              </div>
            </>
          );
          return (
            <article className={item.readAt ? "" : "unread"} key={item.id}>
              {item.href ? (
                <Link
                  className="notification-main"
                  href={item.href}
                  onClick={() => void setRead(item.id, true)}
                >
                  {message}
                </Link>
              ) : (
                <div className="notification-main">{message}</div>
              )}
              <button
                className="icon-button notification-read-toggle"
                aria-label={item.readAt ? `Mark ${item.title} unread` : `Mark ${item.title} read`}
                title={item.readAt ? "Mark unread" : "Mark read"}
                onClick={() => void setRead(item.id, Boolean(!item.readAt))}
              >
                <Check size={14} />
              </button>
              {!item.readAt && <span className="unread-dot" aria-hidden="true" />}
            </article>
          );
        })}
      </section>
    </>
  );
}
