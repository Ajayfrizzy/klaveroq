"use client";

import { MessageSquareText, Send, X } from "lucide-react";
import { useState } from "react";

type Message = {
  id: string;
  senderUserId: string;
  senderName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
};

export function ProposalThread({
  proposalId,
  currentUserId,
  closed = false,
  initialUnreadCount = 0,
}: {
  proposalId: string;
  currentUserId: string;
  closed?: boolean;
  initialUnreadCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  const load = async () => {
    setOpen(true);
    if (messages.length) return;
    setLoading(true);
    setError("");
    const response = await fetch(`/api/marketplace/proposals/${proposalId}/messages`);
    const result = await response.json();
    if (response.ok) {
      setMessages(result.data);
      setUnreadCount(0);
    } else setError(result.error?.message ?? "Clarification thread could not be loaded.");
    setLoading(false);
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError("");
    const response = await fetch(`/api/marketplace/proposals/${proposalId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ body }),
    });
    const result = await response.json();
    if (response.ok) {
      setMessages((items) => [
        ...items,
        {
          ...result.data,
          senderName: "You",
          createdAt: result.data.createdAt,
          editedAt: null,
        },
      ]);
      setBody("");
    } else setError(result.error?.message ?? "Message could not be sent.");
    setSending(false);
  };

  if (!open)
    return (
      <button type="button" className="secondary-button thread-open" onClick={load}>
        <MessageSquareText size={15} /> Clarify proposal
        {unreadCount > 0 && <span className="thread-unread-count">{unreadCount}</span>}
      </button>
    );

  return (
    <section className="proposal-thread">
      <header>
        <div>
          <MessageSquareText size={16} />
          <strong>Pre-hire clarification</strong>
        </div>
        <button
          className="icon-button"
          onClick={() => setOpen(false)}
          aria-label="Close clarification thread"
          title="Close"
        >
          <X size={15} />
        </button>
      </header>
      <div className="proposal-messages" aria-live="polite">
        {loading ? (
          <p>Loading conversation...</p>
        ) : messages.length ? (
          messages.map((message) => (
            <article
              className={message.senderUserId === currentUserId ? "own" : ""}
              key={message.id}
            >
              <span>{message.senderUserId === currentUserId ? "You" : message.senderName}</span>
              <p>{message.body}</p>
              <time>{new Date(message.createdAt).toLocaleString()}</time>
            </article>
          ))
        ) : (
          <p>No messages yet. Ask a focused question about scope, timing, or milestones.</p>
        )}
      </div>
      {error && <p className="form-feedback error">{error}</p>}
      {closed ? (
        <p className="thread-closed-note">This pre-hire clarification thread is closed.</p>
      ) : (
        <form onSubmit={send}>
          <label>
            Message
            <textarea
              rows={3}
              maxLength={2000}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Ask about delivery, milestone structure, scope, or timing."
            />
            <small>{body.length}/2,000</small>
          </label>
          <button className="primary-button" disabled={sending || !body.trim()}>
            <Send size={15} /> {sending ? "Sending..." : "Send"}
          </button>
        </form>
      )}
    </section>
  );
}
