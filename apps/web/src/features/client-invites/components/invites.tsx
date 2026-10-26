"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Invite = {
  id: string;
  email: string;
  projectTitle: string;
  status: string;
  expiresAt: string;
  createdAt: string;
};
async function post(path: string, input: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "Please try again.");
  return body.data;
}
export function InviteWorkspace({ history }: { history: Invite[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [link, setLink] = useState("");
  async function act(path: string, input: unknown) {
    setBusy(true);
    setError("");
    setNotice("");
    setLink("");
    try {
      const data = await post(path, input);
      if (data.link) {
        setLink(data.link);
        setNotice(
          data.emailQueued
            ? "Invitation saved and email processed. You can also copy the link below."
            : "Invitation saved. Email delivery is pending or suppressed by preferences. You can share the link below.",
        );
      } else setNotice("Invitation revoked. Its link no longer works.");
      router.refresh();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="client-invites">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Bring your clients to Klaveroq</p>
          <h1>Invite a Client</h1>
          <p>
            Agree on the work, milestones, and deadlines together. Invitations and agreement
            creation are free.
          </p>
        </div>
      </div>
      <section className="panel invite-panel">
        <h2>Send an invitation</h2>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const fields = new FormData(form);
            if (await act("/api/client-invites", Object.fromEntries(fields))) form.reset();
          }}
        >
          <label>
            Client email
            <input name="email" type="email" required maxLength={320} autoComplete="email" />
          </label>
          <label>
            Project title (optional)
            <input name="projectTitle" maxLength={90} />
          </label>
          <label>
            Personal message (optional)
            <textarea name="message" maxLength={2000} rows={4} />
          </label>
          <p>Links expire after seven days and can only be used by the invited email address.</p>
          <button className="primary-button" disabled={busy}>
            {busy ? "Saving…" : "Send invitation"}
          </button>
        </form>
      </section>
      {error && (
        <p role="alert" className="form-errors">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {link && (
        <section className="panel invite-panel">
          <label>
            Invitation link
            <input readOnly value={link} onFocus={(event) => event.target.select()} />
          </label>
          <button
            className="secondary-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setNotice("Invitation link copied.");
              } catch {
                setError("Select the invitation link and copy it manually.");
              }
            }}
          >
            Copy invitation link
          </button>
          <p>Save this link now. Resend from history to generate a new link.</p>
        </section>
      )}
      <section className="panel invite-panel">
        <h2>Invitation history</h2>
        {!history.length && <p>No invitations yet. Bring your first client above.</p>}
        <ul className="invite-history">
          {history.map((invite) => (
            <li key={invite.id}>
              <div>
                <strong>{invite.email}</strong>
                <p>{invite.projectTitle || "Client collaboration"}</p>
                <span>{invite.status.toLowerCase()}</span>
                <p>
                  Sent {new Date(invite.createdAt).toLocaleDateString("en-NG")} · Expires{" "}
                  {new Date(invite.expiresAt).toLocaleDateString("en-NG")}
                </p>
              </div>
              {["PENDING", "EXPIRED"].includes(invite.status) && (
                <div className="invite-actions">
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => act(`/api/client-invites/${invite.id}`, { action: "resend" })}
                  >
                    Resend
                  </button>
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => act(`/api/client-invites/${invite.id}`, { action: "revoke" })}
                  >
                    Revoke
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <p>Showing the most recent 100 invitations.</p>
      </section>
    </div>
  );
}
export function InvitationResponse({
  token,
  invite,
}: {
  token: string;
  invite: { id: string; name: string; projectTitle: string; message: string; status: string };
}) {
  const [status, setStatus] = useState(invite.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function respond(action: "accept" | "decline") {
    setBusy(true);
    setError("");
    try {
      const result = await post("/api/client-invites/respond", { token, action });
      setStatus(result.status);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel invite-panel">
      <p className="eyebrow">Client invitation</p>
      <h1>
        {status === "ACCEPTED" ? `Work with ${invite.name}` : `An invitation from ${invite.name}`}
      </h1>
      {invite.projectTitle && <h2>{invite.projectTitle}</h2>}
      {invite.message && <p className="invite-message">{invite.message}</p>}
      <p>
        Invitations and agreement creation are free. No wallet is needed and accepting does not move
        money.
      </p>
      {status === "PENDING" ? (
        <div className="invite-actions">
          <button className="primary-button" disabled={busy} onClick={() => respond("accept")}>
            Accept invitation
          </button>
          <button className="secondary-button" disabled={busy} onClick={() => respond("decline")}>
            Decline invitation
          </button>
        </div>
      ) : status === "ACCEPTED" ? (
        <>
          <p>
            You can create a private agreement with your freelancer or explore all client features.
          </p>
          <AgreementLinks id={invite.id} />
          <Link href="/dashboard">Go to dashboard</Link>
        </>
      ) : (
        <p role="status">
          This invitation is {status.toLowerCase()}. Contact your freelancer if you need a new
          invitation.
        </p>
      )}
      {error && (
        <p className="form-errors" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
export function AgreementLinks({ id, name }: { id: string; name?: string }) {
  return (
    <div className="invite-actions">
      <Link className="primary-button" href={`/jobs/new/direct?invitation=${id}`}>
        {name ? `Create Agreement with ${name}` : "Create Agreement"}
      </Link>
      <Link className="secondary-button" href="/jobs/new/public">
        Post Public Job
      </Link>
    </div>
  );
}
