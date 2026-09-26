"use client";

import { ArrowLeft, Download, Paperclip, Send } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Message = {
  id: string;
  senderType: string;
  message: string;
  createdAt: string;
};
type Attachment = {
  id: string;
  messageId: string;
  originalName: string;
  sizeBytes: number;
};
type Detail = {
  ticket: {
    id: string;
    reference: string;
    subject: string;
    category: string;
    status: string;
    priority: string;
    referenceId?: string;
  };
  messages: Message[];
  attachments: Attachment[];
};

export function TicketConversation({
  ticketId,
  admin = false,
}: {
  ticketId: string;
  admin?: boolean;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [internal, setInternal] = useState(false);
  const base = admin
    ? `/api/admin/support/tickets/${ticketId}`
    : `/api/support/tickets/${ticketId}`;
  const load = useCallback(async () => {
    const response = await fetch(base);
    const body = await response.json();
    if (response.ok) setDetail(body.data);
    else setError(body.error?.message ?? "Unable to load this support case.");
  }, [base]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("file") as File;
    const response = await fetch(`${base}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        message: form.get("message"),
        internal: admin && internal,
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setSending(false);
      return setError(body.error?.message ?? "Unable to send your reply.");
    }
    if (file?.size) {
      const upload = new FormData();
      upload.set("messageId", body.data.id);
      upload.set("file", file);
      const uploadResponse = await fetch(`/api/support/tickets/${ticketId}/attachments`, {
        method: "POST",
        body: upload,
      });
      if (!uploadResponse.ok)
        setError("The reply was sent, but its attachment could not be uploaded.");
    }
    formElement.reset();
    setInternal(false);
    setSending(false);
    await load();
  }
  async function closeTicket() {
    const response = await fetch(`/api/support/tickets/${ticketId}/close`, {
      method: "POST",
    });
    if (response.ok) await load();
  }
  async function reopenTicket() {
    setError("");
    const response = await fetch(`/api/support/tickets/${ticketId}/reopen`, {
      method: "POST",
    });
    if (response.ok) await load();
    else {
      const body = await response.json();
      setError(body.error?.message ?? "Unable to reopen this case.");
    }
  }
  if (!detail) return <div className="support-loading">{error || "Loading support case..."}</div>;
  const attachments = (messageId: string) =>
    detail.attachments.filter((file) => file.messageId === messageId);
  return (
    <div className="ticket-page">
      <div className="ticket-topline">
        <Link className="back-link" href={admin ? "/admin/support" : "/support"}>
          <ArrowLeft size={15} /> Back to cases
        </Link>
        {!admin && !["CLOSED", "RESOLVED"].includes(detail.ticket.status) && (
          <button className="secondary-button" onClick={closeTicket}>
            Close case
          </button>
        )}
        {!admin && ["CLOSED", "RESOLVED"].includes(detail.ticket.status) && (
          <button className="secondary-button" onClick={reopenTicket}>
            Reopen case
          </button>
        )}
      </div>
      <header className="ticket-header">
        <div>
          <p className="eyebrow">{detail.ticket.reference}</p>
          <h1>{detail.ticket.subject}</h1>
          <p>
            {detail.ticket.category.toLowerCase()}{" "}
            {detail.ticket.referenceId ? `· ${detail.ticket.referenceId}` : ""}
          </p>
        </div>
        <span className={`ticket-state state-${detail.ticket.status.toLowerCase()}`}>
          {detail.ticket.status.toLowerCase().replaceAll("_", " ")}
        </span>
      </header>
      <section className="panel conversation">
        <div className="conversation-list">
          {detail.messages.map((message) => (
            <article
              className={`message-bubble ${message.senderType.toLowerCase()}`}
              key={message.id}
            >
              <div>
                <strong>
                  {message.senderType === "USER"
                    ? "You"
                    : message.senderType === "SUPPORT"
                      ? "Klaveroq support"
                      : "Internal note"}
                </strong>
                <time>{new Date(message.createdAt).toLocaleString()}</time>
              </div>
              <p>{message.message}</p>
              {attachments(message.id).map((file) => (
                <a
                  className="attachment-link"
                  href={`/api/support/attachments/${file.id}`}
                  key={file.id}
                >
                  <Download size={14} /> {file.originalName}{" "}
                  <small>{Math.ceil(file.sizeBytes / 1024)} KB</small>
                </a>
              ))}
            </article>
          ))}
        </div>
        {detail.ticket.status !== "CLOSED" && (
          <form className="reply-composer" onSubmit={reply}>
            <label>
              <span>{admin && internal ? "Internal note" : "Reply"}</span>
              <textarea
                name="message"
                required
                maxLength={5000}
                rows={4}
                placeholder={
                  admin && internal
                    ? "Only support administrators can see this note."
                    : "Write a reply..."
                }
              />
            </label>
            <div>
              {admin && (
                <label className="internal-toggle">
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={(event) => setInternal(event.target.checked)}
                  />{" "}
                  Internal note
                </label>
              )}
              <label className="attachment-button">
                <Paperclip size={16} />
                <span>Add attachment</span>
                <input
                  name="file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
                />
              </label>
              <button className="primary-button" disabled={sending}>
                <Send size={15} /> {sending ? "Sending..." : "Send reply"}
              </button>
            </div>
            {error && <p className="form-feedback error">{error}</p>}
          </form>
        )}
      </section>
    </div>
  );
}
