"use client";

import type { MilestoneDraft } from "@klaveroq/domain";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CircleDollarSign,
  Info,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const steps = ["Job details", "Milestones", "Invite worker", "Review"];
const emptyMilestone = (index: number): MilestoneDraft => ({
  id: crypto.randomUUID(),
  title: `Milestone ${index}`,
  description: "",
  acceptanceCriteria: "",
  amount: 0,
  dueDate: "",
  evidence: "",
});
const format = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value || 0);

export type SelectedTalent = {
  userId: string;
  displayName: string;
  headline?: string | null;
  primaryRole?: string | null;
  skills: string[];
  identityVerified: boolean;
};

export function JobWizard({ selectedTalent }: { selectedTalent?: SelectedTalent }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [worker, setWorker] = useState("");
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([emptyMilestone(1)]);
  const [errors, setErrors] = useState<string[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const subtotal = useMemo(
    () => milestones.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [milestones],
  );
  const clientFee = subtotal * 0.03;
  const networkReserve = subtotal ? Math.max(0.2, subtotal * 0.00001) : 0;

  const updateMilestone = (id: string, field: keyof MilestoneDraft, value: string | number) => {
    setMilestones((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const validate = () => {
    const nextErrors: string[] = [];
    if (step === 0 && title.trim().length < 5)
      nextErrors.push("Add a clear job title with at least 5 characters.");
    if (step === 0 && description.trim().length < 20)
      nextErrors.push("Describe the scope and expected outcome in at least 20 characters.");
    if (
      step === 1 &&
      milestones.some(
        (item) =>
          !item.title.trim() ||
          !item.description.trim() ||
          !item.acceptanceCriteria.trim() ||
          item.amount <= 0 ||
          !item.dueDate ||
          !item.evidence.trim(),
      )
    )
      nextErrors.push(
        "Complete the title, deliverable, acceptance criteria, amount, due date, and required proof for every milestone.",
      );
    if (step === 2 && !selectedTalent && !/^\S+@\S+\.\S+$/.test(worker))
      nextErrors.push("Enter a valid worker email address.");
    setErrors(nextErrors);
    return nextErrors.length === 0;
  };

  const next = () => {
    if (validate()) {
      setErrors([]);
      setStep((value) => Math.min(3, value + 1));
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    }
  };

  const submit = async () => {
    if (!termsAccepted)
      return setErrors(["Confirm the agreement terms before creating the funding request."]);
    setSubmitting(true);
    setErrors([]);
    try {
      const milestonePayload = milestones.map((item) => ({
        title: item.title,
        description: item.description,
        acceptanceCriteria: item.acceptanceCriteria,
        amount: BigInt(Math.round(Number(item.amount) * 100_000_000)).toString(),
        dueAt: new Date(`${item.dueDate}T23:59:59`).toISOString(),
        evidenceRequirements: item.evidence,
      }));
      const smallestSubtotal = milestonePayload
        .reduce((sum, item) => sum + BigInt(item.amount), 0n)
        .toString();
      const quoteResponse = await fetch("/api/fees/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtotal: smallestSubtotal, asset: "CKB" }),
      });
      const quoteBody = await quoteResponse.json();
      if (!quoteResponse.ok)
        throw new Error(quoteBody.error?.message ?? "The fee quote could not be created.");
      const jobResponse = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          title,
          description,
          ...(selectedTalent ? { workerUserId: selectedTalent.userId } : { workerEmail: worker }),
          asset: "CKB",
          assetDecimals: 8,
          feeQuoteId: quoteBody.data.id,
          milestones: milestonePayload,
        }),
      });
      const jobBody = await jobResponse.json();
      if (!jobResponse.ok)
        throw new Error(jobBody.error?.message ?? "The job could not be created.");
      router.push(`/jobs/${jobBody.data.id}`);
      router.refresh();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "The job could not be created."]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wizard-page">
      <div className="wizard-heading">
        <Link className="back-link" href="/">
          <ArrowLeft size={17} /> Overview
        </Link>
        <div>
          <p className="eyebrow">Protected agreement</p>
          <h1>Create a new job</h1>
          <p>Set the work, milestones, and funding terms before inviting your worker.</p>
        </div>
      </div>

      <ol className="stepper">
        {steps.map((label, index) => (
          <li className={index === step ? "active" : index < step ? "done" : ""} key={label}>
            <span>{index < step ? <Check size={15} /> : index + 1}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>

      <div className="wizard-layout">
        <section className="form-panel">
          {errors.length > 0 && (
            <div className="form-errors" role="alert">
              <strong>Check the following</strong>
              {errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          )}

          {step === 0 && (
            <div className="form-section">
              <div className="form-title">
                <span>
                  <Info size={19} />
                </span>
                <div>
                  <h2>Job details</h2>
                  <p>Describe the complete outcome in language both parties can verify.</p>
                </div>
              </div>
              <label>
                Job title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Ecommerce checkout redesign"
                  maxLength={90}
                />
                <small>{title.length}/90 characters</small>
              </label>
              <label>
                Scope and expected outcome
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe what will be delivered, what is not included, and how success will be assessed."
                  rows={7}
                  maxLength={1600}
                />
                <small>{description.length}/1,600 characters</small>
              </label>
              <div className="inline-notice">
                <ShieldCheck size={18} />
                <p>
                  <strong>Terms become immutable after funding.</strong> Material changes will
                  require mutual approval or a replacement agreement.
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="form-section">
              <div className="form-title">
                <span>
                  <CalendarDays size={19} />
                </span>
                <div>
                  <h2>Milestones</h2>
                  <p>Break the job into independently reviewable and payable outcomes.</p>
                </div>
              </div>
              {milestones.map((milestone, index) => (
                <div className="milestone-editor" key={milestone.id}>
                  <div className="milestone-editor-head">
                    <div>
                      <span>{index + 1}</span>
                      <strong>{milestone.title || `Milestone ${index + 1}`}</strong>
                    </div>
                    {milestones.length > 1 && (
                      <button
                        className="icon-button danger"
                        onClick={() =>
                          setMilestones((items) => items.filter((item) => item.id !== milestone.id))
                        }
                        aria-label={`Delete milestone ${index + 1}`}
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>
                  <div className="two-fields">
                    <label>
                      Milestone title
                      <input
                        value={milestone.title}
                        onChange={(event) =>
                          updateMilestone(milestone.id, "title", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Amount (CKB)
                      <div className="amount-input">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={milestone.amount || ""}
                          onChange={(event) =>
                            updateMilestone(milestone.id, "amount", Number(event.target.value))
                          }
                        />
                        <span>CKB</span>
                      </div>
                    </label>
                  </div>
                  <label>
                    Deliverable
                    <textarea
                      rows={3}
                      value={milestone.description}
                      onChange={(event) =>
                        updateMilestone(milestone.id, "description", event.target.value)
                      }
                      placeholder="What must the worker deliver?"
                    />
                  </label>
                  <label>
                    Acceptance criteria
                    <textarea
                      rows={3}
                      value={milestone.acceptanceCriteria}
                      onChange={(event) =>
                        updateMilestone(milestone.id, "acceptanceCriteria", event.target.value)
                      }
                      placeholder="What objective conditions must be met for approval?"
                    />
                  </label>
                  <div className="two-fields">
                    <label>
                      Due date
                      <input
                        type="date"
                        value={milestone.dueDate}
                        onChange={(event) =>
                          updateMilestone(milestone.id, "dueDate", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Required proof
                      <input
                        value={milestone.evidence}
                        onChange={(event) =>
                          updateMilestone(milestone.id, "evidence", event.target.value)
                        }
                        placeholder="e.g. Figma link and PDF"
                      />
                    </label>
                  </div>
                </div>
              ))}
              <button
                className="secondary-button add-milestone"
                disabled={milestones.length >= 10}
                onClick={() =>
                  setMilestones((items) => [...items, emptyMilestone(items.length + 1)])
                }
              >
                <Plus size={17} /> Add milestone <span>{milestones.length}/10</span>
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="form-section">
              <div className="form-title">
                <span>
                  <UserRound size={19} />
                </span>
                <div>
                  <h2>Invite your worker</h2>
                  <p>
                    They can inspect the terms immediately and accept after funding is confirmed.
                  </p>
                </div>
              </div>
              {selectedTalent ? (
                <div className="review-block">
                  <span>Inviting</span>
                  <strong>{selectedTalent.displayName}</strong>
                  <p>
                    {selectedTalent.headline ||
                      selectedTalent.primaryRole ||
                      "Klaveroq professional"}
                  </p>
                  <Link href="/talent" className="secondary-button">
                    Change professional
                  </Link>
                </div>
              ) : (
                <label>
                  Existing member email
                  <input
                    type="email"
                    value={worker}
                    onChange={(event) => setWorker(event.target.value)}
                    placeholder="worker@example.com"
                  />
                  <small>
                    The email must belong to an existing Klaveroq account. External invitations are
                    not supported yet.
                  </small>
                </label>
              )}
              <div className="process-list">
                <div>
                  <span>1</span>
                  <p>
                    <strong>Invitation sent</strong>The worker can review the scope and milestones.
                  </p>
                </div>
                <div>
                  <span>2</span>
                  <p>
                    <strong>Funding remains pending</strong>Payment funding is unavailable until the
                    payment integration is connected.
                  </p>
                </div>
                <div>
                  <span>3</span>
                  <p>
                    <strong>Worker reviews</strong>The worker can accept the recorded agreement
                    terms when eligible.
                  </p>
                </div>
              </div>
              <div className="inline-notice">
                <Info size={18} />
                <p>
                  This creates an invitation record only. It does not fund an agreement or move
                  funds.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="form-section">
              <div className="form-title">
                <span>
                  <ShieldCheck size={19} />
                </span>
                <div>
                  <h2>Review agreement</h2>
                  <p>Confirm these terms before creating the invitation.</p>
                </div>
              </div>
              <div className="review-block">
                <span>Job</span>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
              <div className="review-block">
                <span>Worker</span>
                <strong>{selectedTalent?.displayName ?? worker}</strong>
                {selectedTalent && <p>{selectedTalent.headline || selectedTalent.primaryRole}</p>}
              </div>
              <div className="review-milestones">
                <h3>Milestones</h3>
                {milestones.map((item, index) => (
                  <div key={item.id}>
                    <span>{index + 1}</span>
                    <p>
                      <strong>{item.title}</strong>
                      <small>Acceptance: {item.acceptanceCriteria}</small>
                      <small>
                        {item.dueDate} · Required proof: {item.evidence}
                      </small>
                    </p>
                    <b>{format(item.amount)} CKB</b>
                  </div>
                ))}
              </div>
              <label className="terms-check">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                />
                <span>
                  I confirm the scope, milestone amounts, fees, review window, and
                  funding-before-acceptance process.
                </span>
              </label>
            </div>
          )}

          <div className="wizard-actions">
            <button
              className="secondary-button"
              disabled={step === 0 || submitting}
              onClick={() => {
                setErrors([]);
                setStep((value) => Math.max(0, value - 1));
              }}
            >
              <ArrowLeft size={17} /> Back
            </button>
            {step < 3 ? (
              <button className="primary-button" onClick={next}>
                Continue <ArrowRight size={17} />
              </button>
            ) : (
              <button className="primary-button" disabled={submitting} onClick={submit}>
                <ShieldCheck size={17} /> {submitting ? "Creating..." : "Create invitation"}
              </button>
            )}
          </div>
        </section>

        <aside className="funding-summary">
          <div className="summary-head">
            <CircleDollarSign size={20} />
            <div>
              <h2>Funding summary</h2>
              <p>Recorded agreement estimate</p>
            </div>
          </div>
          <dl>
            <div>
              <dt>Milestone subtotal</dt>
              <dd>{format(subtotal)} CKB</dd>
            </div>
            <div>
              <dt>
                Client protection fee <span>3%</span>
              </dt>
              <dd>{format(clientFee)} CKB</dd>
            </div>
            <div>
              <dt>Network reserve</dt>
              <dd>{format(networkReserve)} CKB</dd>
            </div>
            <div className="summary-total">
              <dt>Estimated total</dt>
              <dd>{format(subtotal + clientFee + networkReserve)} CKB</dd>
            </div>
          </dl>
          <div className="worker-receives">
            <span>Worker receives after 2% fee</span>
            <strong>{format(subtotal * 0.98)} CKB</strong>
          </div>
          <p className="summary-foot">
            <ShieldCheck size={15} /> No funds are secured or transferred by this workflow. Payment
            integration is not connected.
          </p>
        </aside>
      </div>
    </div>
  );
}
