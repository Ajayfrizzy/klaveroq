"use client";

import { ArrowLeft, CheckCircle2, Info, Plus, Send, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Milestone = {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  amount: string;
  evidenceRequirements: string;
  deliveryDays: number;
};
type ExistingProposal = {
  coverLetter: string;
  estimatedDurationDays: number;
  milestones: Array<Omit<Milestone, "id"> & { amount: string }>;
};

const blank = (): Milestone => ({
  id: crypto.randomUUID(),
  title: "",
  description: "",
  acceptanceCriteria: "",
  amount: "",
  evidenceRequirements: "",
  deliveryDays: 7,
});
const displayAmount = (smallestUnits: string) => {
  const value = BigInt(smallestUnits);
  const whole = value / 100_000_000n;
  const fraction = (value % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}`;
};
const toUnits = (value: string) => {
  const normalized = value.trim();
  if (!/^\d+(\.\d{1,8})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * 100_000_000n + BigInt(fraction.padEnd(8, "0"));
};
const formatCkb = (value: bigint) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(Number(value) / 100_000_000);

export function ProposalComposer({
  listingId,
  signedIn,
  existing,
  budgetMin,
  budgetMax,
}: {
  listingId: string;
  signedIn: boolean;
  budgetMin: string;
  budgetMax: string;
  existing?: ExistingProposal;
}) {
  const router = useRouter();
  const [coverLetter, setCoverLetter] = useState(existing?.coverLetter ?? "");
  const [items, setItems] = useState<Milestone[]>(
    existing?.milestones.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      amount: displayAmount(item.amount),
    })) ?? [blank()],
  );
  const [phase, setPhase] = useState<"edit" | "review">("edit");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantNote, setAssistantNote] = useState("");
  const minBudget = BigInt(budgetMin);
  const maxBudget = BigInt(budgetMax);
  const total = useMemo(
    () => items.reduce((sum, item) => sum + (toUnits(item.amount) ?? 0n), 0n),
    [items],
  );
  const workerFee = (total * 200n) / 10_000n;
  const workerNet = total - workerFee;
  const withinBudget = total >= minBudget && total <= maxBudget;
  const update = (id: string, key: keyof Milestone, value: string | number) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    );
    setErrors([]);
  };

  const validate = () => {
    const next: string[] = [];
    if (coverLetter.trim().length < 40)
      next.push("Write at least 40 characters in your cover letter.");
    items.forEach((item, index) => {
      if (item.title.trim().length < 2) next.push(`Add a title for milestone ${index + 1}.`);
      if (item.description.trim().length < 10)
        next.push(`Describe the deliverable for milestone ${index + 1}.`);
      if (item.acceptanceCriteria.trim().length < 5)
        next.push(`Add objective acceptance criteria for milestone ${index + 1}.`);
      if (!toUnits(item.amount) || toUnits(item.amount) === 0n)
        next.push(`Enter a valid positive CKB amount for milestone ${index + 1}.`);
      if (item.evidenceRequirements.trim().length < 5)
        next.push(`Describe the required proof for milestone ${index + 1}.`);
      if (
        item.deliveryDays < 1 ||
        item.deliveryDays > 365 ||
        (index > 0 && item.deliveryDays <= items[index - 1].deliveryDays)
      )
        next.push(
          `Milestone ${index + 1} must have a later delivery day than the previous milestone.`,
        );
    });
    if (!withinBudget)
      next.push(
        `Keep the proposal total between ${formatCkb(minBudget)} and ${formatCkb(maxBudget)} CKB.`,
      );
    setErrors([...new Set(next)]);
    return next.length === 0;
  };

  const assist = async () => {
    if (!signedIn) {
      router.push(`/login?returnTo=/discover/${listingId}`);
      return;
    }
    setAssistantBusy(true);
    setErrors([]);
    setAssistantNote("");
    const response = await fetch("/api/ai/proposal-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    });
    const body = await response.json();
    if (!response.ok) setErrors([body.error?.message ?? "Proposal assistance is unavailable."]);
    else {
      setCoverLetter(body.data.coverLetter);
      setItems(
        body.data.milestones.map(
          (item: {
            title: string;
            deliverable: string;
            acceptanceCriteria: string;
            evidenceRequirements: string;
            deliveryDays: number;
            amount: string;
          }) => ({
            id: crypto.randomUUID(),
            title: item.title,
            description: item.deliverable,
            acceptanceCriteria: item.acceptanceCriteria,
            evidenceRequirements: item.evidenceRequirements,
            deliveryDays: item.deliveryDays,
            amount: displayAmount(item.amount),
          }),
        ),
      );
      setAssistantNote(
        "Draft generated - review every suggested claim, milestone, amount, and timing before submission.",
      );
    }
    setAssistantBusy(false);
  };

  const review = (event: React.FormEvent) => {
    event.preventDefault();
    if (validate()) {
      setPhase("review");
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    }
  };
  const submit = async () => {
    if (!signedIn) {
      router.push(`/login?returnTo=/discover/${listingId}`);
      return;
    }
    if (!validate()) {
      setPhase("edit");
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      const payload = {
        coverLetter,
        totalBid: total.toString(),
        estimatedDurationDays: items.at(-1)?.deliveryDays ?? 1,
        milestones: items.map((item) => ({
          title: item.title,
          description: item.description,
          acceptanceCriteria: item.acceptanceCriteria,
          amount: toUnits(item.amount)!.toString(),
          evidenceRequirements: item.evidenceRequirements,
          deliveryDays: item.deliveryDays,
        })),
      };
      const response = await fetch(
        `/api/marketplace/listings/${listingId}/${existing ? "proposal" : "proposals"}`,
        {
          method: existing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
          body: JSON.stringify(payload),
        },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Proposal could not be saved.");
      router.refresh();
    } catch (reason) {
      setErrors([reason instanceof Error ? reason.message : "Proposal could not be saved."]);
      setPhase("edit");
    } finally {
      setBusy(false);
    }
  };
  const withdraw = async () => {
    if (!confirm("Withdraw this proposal? This cannot be undone.")) return;
    setBusy(true);
    const response = await fetch(`/api/marketplace/listings/${listingId}/proposal`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const body = await response.json();
      setErrors([body.error?.message ?? "Proposal could not be withdrawn."]);
    } else router.refresh();
    setBusy(false);
  };

  if (phase === "review")
    return (
      <section className="proposal-form proposal-review">
        <div className="section-heading">
          <div>
            <h2>Review your proposal</h2>
            <p>Confirm the terms before sending them to the client.</p>
          </div>
        </div>
        <div className="proposal-review-body">
          <div className="review-callout">
            <CheckCircle2 size={20} />
            <div>
              <strong>{formatCkb(total)} CKB proposal</strong>
              <span>
                You receive approximately {formatCkb(workerNet)} CKB after the 2% worker fee.
              </span>
            </div>
          </div>
          <section>
            <span>Cover letter</span>
            <p>{coverLetter}</p>
          </section>
          <section>
            <span>Milestone schedule</span>
            <ol>
              {items.map((item, index) => (
                <li key={item.id}>
                  <b>{index + 1}</b>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                    <small>Acceptance: {item.acceptanceCriteria}</small>
                    <small>
                      Required proof: {item.evidenceRequirements} · Due {item.deliveryDays} days
                      after project start
                    </small>
                  </div>
                  <em>{item.amount} CKB</em>
                </li>
              ))}
            </ol>
          </section>
          <dl>
            <div>
              <dt>Proposal total</dt>
              <dd>{formatCkb(total)} CKB</dd>
            </div>
            <div>
              <dt>Worker fee (2%)</dt>
              <dd>−{formatCkb(workerFee)} CKB</dd>
            </div>
            <div>
              <dt>Estimated payout</dt>
              <dd>{formatCkb(workerNet)} CKB</dd>
            </div>
          </dl>
          <div className="proposal-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => setPhase("edit")}
            >
              <ArrowLeft size={16} /> Edit proposal
            </button>
            <button type="button" className="primary-button" disabled={busy} onClick={submit}>
              <Send size={16} />{" "}
              {busy ? "Sending..." : existing ? "Confirm update" : "Confirm and submit"}
            </button>
          </div>
        </div>
      </section>
    );

  return (
    <form className="proposal-form" onSubmit={review} noValidate>
      <div className="section-heading">
        <div>
          <h2>{existing ? "Edit your proposal" : "Submit a proposal"}</h2>
          <p>Only the client can see your terms.</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          disabled={assistantBusy}
          onClick={assist}
        >
          <Sparkles size={15} /> {assistantBusy ? "Preparing..." : "Draft with assistant"}
        </button>
      </div>
      <div className="proposal-fields">
        {errors.length > 0 && (
          <div className="form-errors" role="alert">
            <strong>Review these details</strong>
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}
        {assistantNote && (
          <div className="assistant-note">
            <Sparkles size={15} />
            <p>{assistantNote}</p>
          </div>
        )}
        <label>
          Cover letter
          <textarea
            required
            minLength={40}
            maxLength={5000}
            rows={6}
            value={coverLetter}
            onChange={(event) => {
              setCoverLetter(event.target.value);
              setErrors([]);
            }}
            placeholder="Explain your approach, relevant experience, and what you will deliver."
          />
          <small>{coverLetter.length}/5,000 characters · Minimum 40</small>
        </label>
        <div className="proposal-guidance">
          <Info size={16} />
          <p>
            Your milestone amounts make up the proposal total. Delivery timing starts when the
            funded agreement begins.
          </p>
        </div>
        {items.map((item, index) => (
          <fieldset key={item.id}>
            <legend>Milestone {index + 1}</legend>
            {items.length > 1 && (
              <button
                type="button"
                className="icon-button danger"
                onClick={() =>
                  setItems((current) => current.filter((value) => value.id !== item.id))
                }
                aria-label={`Remove milestone ${index + 1}`}
                title="Remove milestone"
              >
                <Trash2 size={16} />
              </button>
            )}
            <label>
              Milestone title
              <input
                required
                minLength={2}
                value={item.title}
                onChange={(event) => update(item.id, "title", event.target.value)}
                placeholder="e.g. Research and wireframes"
              />
            </label>
            <label>
              What will you deliver?
              <textarea
                required
                minLength={10}
                rows={3}
                value={item.description}
                onChange={(event) => update(item.id, "description", event.target.value)}
                placeholder="Describe the outcome the client will receive."
              />
              <small>Formal term: deliverable</small>
            </label>
            <label>
              How will success be confirmed?
              <textarea
                required
                minLength={5}
                rows={3}
                value={item.acceptanceCriteria}
                onChange={(event) => update(item.id, "acceptanceCriteria", event.target.value)}
                placeholder="State the objective conditions the client can use to approve this milestone."
              />
              <small>Formal term: acceptance criteria</small>
            </label>
            <div className="proposal-term-fields">
              <label>
                Milestone amount
                <div className="currency-input">
                  <input
                    required
                    inputMode="decimal"
                    value={item.amount}
                    onChange={(event) => update(item.id, "amount", event.target.value)}
                    placeholder="0"
                  />
                  <span>CKB</span>
                </div>
              </label>
              <label>
                Delivery time
                <div className="duration-input">
                  <input
                    required
                    type="number"
                    min={index ? items[index - 1].deliveryDays + 1 : 1}
                    max={365}
                    value={item.deliveryDays}
                    onChange={(event) =>
                      update(item.id, "deliveryDays", Number(event.target.value))
                    }
                  />
                  <span>days</span>
                </div>
                <small>After the project starts</small>
              </label>
            </div>
            <label>
              What proof will you provide?
              <input
                required
                minLength={5}
                value={item.evidenceRequirements}
                onChange={(event) => update(item.id, "evidenceRequirements", event.target.value)}
                placeholder="e.g. Preview URL, source commit, and test report"
              />
              <small>Formal term: required proof</small>
            </label>
          </fieldset>
        ))}
        <button
          type="button"
          className="secondary-button add-proposal-milestone"
          disabled={items.length >= 10}
          onClick={() =>
            setItems((current) => [
              ...current,
              { ...blank(), deliveryDays: (current.at(-1)?.deliveryDays ?? 0) + 7 },
            ])
          }
        >
          <Plus size={16} /> Add milestone <span>{items.length}/10</span>
        </button>
        <div className={`proposal-total ${total > 0n && !withinBudget ? "outside-budget" : ""}`}>
          <div>
            <span>Proposal total</span>
            <strong>{formatCkb(total)} CKB</strong>
            <small>
              Client budget: {formatCkb(minBudget)}–{formatCkb(maxBudget)} CKB
            </small>
          </div>
          <dl>
            <div>
              <dt>Worker fee</dt>
              <dd>−{formatCkb(workerFee)} CKB</dd>
            </div>
            <div>
              <dt>Estimated payout</dt>
              <dd>{formatCkb(workerNet)} CKB</dd>
            </div>
          </dl>
          {total > 0n && (
            <p>
              {withinBudget
                ? "Your proposal is within the client’s budget."
                : "Adjust milestone amounts to fit the client’s budget."}
            </p>
          )}
        </div>
        <div className="proposal-actions proposal-edit-actions">
          {existing ? (
            <button
              type="button"
              className="secondary-button danger-text"
              disabled={busy}
              onClick={withdraw}
            >
              <X size={16} /> Withdraw
            </button>
          ) : (
            <Link className="secondary-button" href={`/discover/${listingId}`}>
              Cancel
            </Link>
          )}
          <button className="primary-button" disabled={busy}>
            Review proposal <CheckCircle2 size={16} />
          </button>
        </div>
      </div>
    </form>
  );
}
