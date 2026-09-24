"use client";

import {
  ArrowRight,
  BookOpen,
  CircleHelp,
  FileQuestion,
  MessageSquareText,
  Plus,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";

type Ticket = {
  id: string;
  reference: string;
  subject: string;
  category: string;
  status: string;
  updatedAt: string;
};
const labels: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING_FOR_USER: "Waiting for you",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export function SupportHome() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/support/tickets");
    const body = await response.json();
    if (response.ok) setTickets(body.data);
    else setError(body.error?.message ?? "Unable to load support cases.");
    setLoading(false);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: form.get("category"),
        subject: form.get("subject"),
        referenceId: form.get("referenceId"),
        message: form.get("message"),
      }),
    });
    const body = await response.json();
    setSubmitting(false);
    if (!response.ok) return setError(body.error?.message ?? "Unable to create the support case.");
    event.currentTarget.reset();
    setSuccess(`${body.data.reference} was created. Our support team can now review it.`);
    await load();
  }
  return (
    <>
      <PageHeader
        eyebrow="Help center"
        title="Support"
        description="Get help with jobs, payments, wallet security, or disputes."
        icon={CircleHelp}
        action={
          <a className="primary-button" href="#new-case">
            <Plus size={16} /> New support case
          </a>
        }
      />
      <section className="support-categories">
        <a href="#new-case">
          <span>
            <MessageSquareText size={21} />
          </span>
          <div>
            <h2>General support</h2>
            <p>Account, job, and product questions</p>
          </div>
          <ArrowRight size={17} />
        </a>
        <a href="#new-case">
          <span>
            <ShieldAlert size={21} />
          </span>
          <div>
            <h2>Report a problem</h2>
            <p>Payment, security, or dispute concerns</p>
          </div>
          <ArrowRight size={17} />
        </a>
        <a href="#guides">
          <span>
            <BookOpen size={21} />
          </span>
          <div>
            <h2>Guides</h2>
            <p>Learn how milestone jobs work</p>
          </div>
          <ArrowRight size={17} />
        </a>
      </section>
      <div className="support-layout">
        <section className="panel support-cases">
          <div className="section-heading">
            <div>
              <h2>Your cases</h2>
              <p>Updates from the Klaveroq support team</p>
            </div>
          </div>
          {loading && <p className="support-empty">Loading cases...</p>}
          {!loading && tickets.length === 0 && (
            <p className="support-empty">No support cases yet.</p>
          )}
          {tickets.map((ticket) => (
            <Link className="support-case-row" href={`/support/${ticket.id}`} key={ticket.id}>
              <span className="case-id">{ticket.reference}</span>
              <div>
                <strong>{ticket.subject}</strong>
                <p>
                  {ticket.category.toLowerCase()} · Updated{" "}
                  {new Date(ticket.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <span className={`ticket-state state-${ticket.status.toLowerCase()}`}>
                {labels[ticket.status]}
              </span>
              <ArrowRight size={16} />
            </Link>
          ))}
        </section>
        <aside className="panel quick-guides" id="guides">
          <h2>Guide topics</h2>
          <div>
            <FileQuestion size={16} /> How funding and acceptance work
          </div>
          <div>
            <FileQuestion size={16} /> Reviewing milestone proof
          </div>
          <div>
            <FileQuestion size={16} /> Changing a payout wallet
          </div>
          <div>
            <FileQuestion size={16} /> Opening a dispute
          </div>
          <p id="guide-content">
            Full guides are not published yet. Create a support case for help and include the
            related reference when available.
          </p>
        </aside>
      </div>
      <section className="panel new-case" id="new-case">
        <div>
          <h2>Contact support</h2>
          <p>Include the relevant job or transaction ID so the team can investigate quickly.</p>
        </div>
        <form onSubmit={submit}>
          <label>
            Topic
            <select name="category" required>
              <option value="JOB">Job or milestone</option>
              <option value="PAYMENT">Payment or refund</option>
              <option value="WALLET">Wallet</option>
              <option value="SECURITY">Security</option>
              <option value="DISPUTE">Dispute</option>
              <option value="GENERAL">General</option>
            </select>
          </label>
          <label>
            Reference ID
            <input name="referenceId" placeholder="Job or payment reference" />
          </label>
          <label className="case-message">
            Subject
            <input
              name="subject"
              minLength={5}
              maxLength={160}
              required
              placeholder="Briefly describe the issue"
            />
          </label>
          <label className="case-message">
            Message
            <textarea
              name="message"
              minLength={10}
              maxLength={5000}
              rows={5}
              required
              placeholder="Describe what happened and what you expected."
            />
          </label>
          {error && <p className="form-feedback error">{error}</p>}
          {success && <p className="form-feedback success">{success}</p>}
          <button className="primary-button" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit case"}
          </button>
        </form>
      </section>
    </>
  );
}
