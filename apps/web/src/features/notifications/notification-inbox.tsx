"use client";
import { Bell, Check, CheckCheck, Mail, Settings2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { formatEventTime } from "@/features/activity/presentation";
type Notification = {
  id: string;
  type?: string;
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
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read }),
        keepalive: true,
      });
      if (!response.ok) throw new Error("Notification could not be updated.");
      window.dispatchEvent(new Event("notifications:changed"));
    } catch {
      await load();
      setError("The read status could not be saved. Please try again.");
    }
  }
  const loadPreferences = useCallback(async () => {
    setShowSettings(true);
    try {
      const response = await fetch("/api/notifications/preferences");
      const body = await response.json();
      if (response.ok) setPreferences(body.data);
      else throw new Error("Notification preferences could not be loaded.");
    } catch {
      setShowSettings(false);
      setError("Notification preferences could not be loaded. Please try again.");
    }
  }, []);
  useEffect(() => {
    const openFromLink = () => {
      if (window.location.hash === "#preferences") void loadPreferences();
    };
    const timer = window.setTimeout(openFromLink, 0);
    const openFromMenu = () => void loadPreferences();
    window.addEventListener("hashchange", openFromLink);
    window.addEventListener("notifications:open-preferences", openFromMenu);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", openFromLink);
      window.removeEventListener("notifications:open-preferences", openFromMenu);
    };
  }, [loadPreferences]);
  function openSettings() {
    if (showSettings) setShowSettings(false);
    else if (preferences) setShowSettings(true);
    else void loadPreferences();
  }
  async function savePreferences(next: Preferences) {
    const previous = preferences;
    setPreferences(next);
    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) {
        const body = await response.json();
        setError(body.error?.message ?? "Notification preferences could not be saved.");
        setPreferences(previous);
      }
    } catch {
      setPreferences(previous);
      setError("Notification preferences could not be saved. Please try again.");
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
        <section
          id="preferences"
          className="panel notification-preferences"
          aria-label="Email preferences"
        >
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
          <div className="notification-loading" role="status" aria-label="Loading notifications">
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
          const security = item.type?.startsWith("SECURITY_") ?? false;
          const message = (
            <>
              <span className="notification-icon">
                {security ? <ShieldAlert size={17} /> : <Bell size={17} />}
              </span>
              <div>
                <strong>{item.title}</strong>
                <small>
                  {security ? "Security alert" : "Marketplace update"} ·{" "}
                  {item.readAt ? "Read" : "Unread"}
                </small>
                <p>{item.body}</p>
                <time dateTime={item.createdAt}>{formatEventTime(item.createdAt)}</time>
              </div>
            </>
          );
          return (
            <article
              className={`${item.readAt ? "" : "unread"} ${security ? "security-notification" : ""}`}
              key={item.id}
            >
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
