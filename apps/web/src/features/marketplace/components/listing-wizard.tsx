"use client";

import { JOB_CATEGORIES } from "@klaveroq/domain";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWorkProtection } from "@/components/ui/use-work-protection";

type ListingMilestone = {
  id: string;
  title: string;
  deliverable: string;
  acceptanceCriteria: string;
  evidenceRequirements: string;
  deliveryDays: number;
};

type Stage = 1 | 2 | 3;

export type ListingDraft = {
  id: string;
  title: string;
  description: string;
  category: (typeof JOB_CATEGORIES)[number];
  skills: string[];
  budgetMin: string;
  budgetMax: string;
  proposalDeadline: string;
  milestones: Array<Omit<ListingMilestone, "id">>;
};

const blankMilestone = (deliveryDays = 7): ListingMilestone => ({
  id: crypto.randomUUID(),
  title: "",
  deliverable: "",
  acceptanceCriteria: "",
  evidenceRequirements: "",
  deliveryDays,
});
const units = (value: string) => BigInt(Math.round(Number(value || 0) * 100_000_000)).toString();
const displayUnits = (value: string) => {
  const amount = BigInt(value);
  const whole = amount / 100_000_000n;
  const fraction = (amount % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}`;
};
const minimumDeadline = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

const stages = [
  { number: 1 as const, label: "Describe the work" },
  { number: 2 as const, label: "Define success" },
  { number: 3 as const, label: "Set terms" },
];

export function ListingWizard({ initialDraft }: { initialDraft?: ListingDraft }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>(1);
  const [reviewing, setReviewing] = useState(false);
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [description, setDescription] = useState(initialDraft?.description ?? "");
  const [category, setCategory] = useState<(typeof JOB_CATEGORIES)[number]>(
    initialDraft?.category ?? "DESIGN",
  );
  const [skills, setSkills] = useState(initialDraft?.skills.join(", ") ?? "");
  const [budgetMin, setBudgetMin] = useState(
    initialDraft ? displayUnits(initialDraft.budgetMin) : "",
  );
  const [budgetMax, setBudgetMax] = useState(
    initialDraft ? displayUnits(initialDraft.budgetMax) : "",
  );
  const [proposalDeadline, setProposalDeadline] = useState(
    initialDraft?.proposalDeadline.slice(0, 10) ?? "",
  );
  const [milestones, setMilestones] = useState<ListingMilestone[]>(
    initialDraft?.milestones.map((item) => ({ ...item, id: crypto.randomUUID() })) ?? [
      blankMilestone(),
    ],
  );
  const [busy, setBusy] = useState(false);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [error, setError] = useState("");
  const [assistantNote, setAssistantNote] = useState("");
  const [draftId, setDraftId] = useState<string | null>(initialDraft?.id ?? null);
  const [draftNeedsUpdate, setDraftNeedsUpdate] = useState(Boolean(initialDraft));
  const [saved, setSaved] = useState(Boolean(initialDraft));
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const {
    root: workRoot,
    dirty: workDirty,
    status: workStatus,
    markSaved,
  } = useWorkProtection(
    JSON.stringify({
      title,
      description,
      category,
      skills,
      budgetMin,
      budgetMax,
      proposalDeadline,
      milestones,
    }),
    error,
  );

  const skillItems = skills
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const updateMilestone = (id: string, field: keyof ListingMilestone, value: string | number) =>
    setMilestones((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );

  const validate = (target: Stage | "all") => {
    if ((target === 1 || target === "all") && description.trim().length < 40)
      return "Describe the work and expected outcome in at least 40 characters.";
    if ((target === 1 || target === "all") && title.trim().length < 5)
      return "Add a clear job title with at least 5 characters.";
    if ((target === 1 || target === "all") && skillItems.length === 0)
      return "Add at least one skill.";
    if (target === 2 || target === "all") {
      const incomplete = milestones.find(
        (item) =>
          item.title.trim().length < 2 ||
          item.deliverable.trim().length < 10 ||
          item.acceptanceCriteria.trim().length < 5 ||
          item.evidenceRequirements.trim().length < 5,
      );
      if (incomplete)
        return "Complete every milestone title, deliverable, success condition, and proof requirement.";
      if (
        milestones.some(
          (item, index) => index > 0 && item.deliveryDays <= milestones[index - 1].deliveryDays,
        )
      )
        return "Milestone timing must increase from one milestone to the next.";
    }
    if (target === 3 || target === "all") {
      if (!budgetMin || Number(budgetMin) <= 0 || !budgetMax || Number(budgetMax) <= 0)
        return "Add a positive minimum and maximum budget.";
      if (Number(budgetMax) < Number(budgetMin))
        return "Maximum budget must be at least the minimum budget.";
      if (!proposalDeadline || proposalDeadline < minimumDeadline)
        return "Choose a proposal deadline that is at least one day from now.";
    }
    return "";
  };

  const continueTo = (next: Stage) => {
    const message = validate(stage);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStage(next);
  };

  const assist = async () => {
    if (description.trim().length < 20) {
      setError("Start with at least 20 characters describing the work you need.");
      return;
    }
    setAssistantBusy(true);
    setError("");
    setAssistantNote("");
    try {
      const response = await fetch("/api/ai/job-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Job assistance is unavailable.");
      setTitle(body.data.title);
      setDescription(body.data.scope);
      setCategory(body.data.category);
      setSkills(body.data.skills.join(", "));
      setMilestones(
        body.data.milestones.map((item: Omit<ListingMilestone, "id">) => ({
          ...item,
          id: crypto.randomUUID(),
        })),
      );
      setAssistantNote(
        `Draft generated - ${body.data.estimatedStructure}. Review the suggested scope and milestones before publishing.`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Job assistance is unavailable.");
    } finally {
      setAssistantBusy(false);
    }
  };

  const openReview = () => {
    const message = validate("all");
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setReviewing(true);
  };

  const payload = () => ({
    title,
    description,
    category,
    skills: skillItems,
    budgetMin: units(budgetMin),
    budgetMax: units(budgetMax),
    proposalDeadline: new Date(`${proposalDeadline}T23:59:59`).toISOString(),
    milestones: milestones.map(
      ({ title, deliverable, acceptanceCriteria, evidenceRequirements, deliveryDays }) => ({
        title,
        deliverable,
        acceptanceCriteria,
        evidenceRequirements,
        deliveryDays,
      }),
    ),
  });

  const saveDraft = async () => {
    const message = validate("all");
    if (message) return setError(message);
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch(
        draftId ? `/api/marketplace/listings/${draftId}` : "/api/marketplace/listings",
        {
          method: draftId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(draftId ? {} : { "Idempotency-Key": idempotencyKey }),
          },
          body: JSON.stringify(payload()),
        },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "The draft could not be saved.");
      setDraftId(body.data.id);
      setDraftNeedsUpdate(false);
      setSaved(true);
      markSaved();
      router.replace(`/jobs/new/public?draft=${body.data.id}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The draft could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const editDraft = () => {
    setError("");
    if (draftId) setDraftNeedsUpdate(true);
    setReviewing(false);
    setStage(1);
  };

  const publish = async () => {
    setBusy(true);
    setError("");
    try {
      let listingId = draftId;
      const listingPayload = payload();
      if (!listingId) {
        const response = await fetch("/api/marketplace/listings", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
          body: JSON.stringify(listingPayload),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message ?? "The draft could not be created.");
        listingId = body.data.id;
        setDraftId(listingId);
      } else if (draftNeedsUpdate) {
        const response = await fetch(`/api/marketplace/listings/${listingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(listingPayload),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message ?? "The draft could not be updated.");
        setDraftNeedsUpdate(false);
      }
      const response = await fetch(`/api/marketplace/listings/${listingId}/publish`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(
          body.error?.message ?? "The job could not be published. Your draft is saved; try again.",
        );
      }
      markSaved();
      router.push(`/discover/${listingId}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The job could not be published.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wizard-page listing-create" ref={workRoot}>
      {workStatus}
      <div className="wizard-heading">
        <Link className="back-link" href="/jobs/new">
          <ArrowLeft size={17} /> Creation options
        </Link>
        <div>
          <p className="eyebrow">Public marketplace</p>
          <h1>{reviewing ? "Review your job" : "Post a public job"}</h1>
          <p>
            {reviewing
              ? "Confirm the complete listing before it becomes visible in the marketplace."
              : "Define the work, make success verifiable, then set the commercial terms."}
          </p>
        </div>
      </div>

      <ol className="listing-steps" aria-label="Job creation progress">
        {stages.map((item) => (
          <li
            className={`${stage === item.number && !reviewing ? "active" : ""} ${stage > item.number || reviewing ? "complete" : ""}`}
            key={item.number}
          >
            <span>{stage > item.number || reviewing ? <Check size={15} /> : item.number}</span>
            <div>
              <small>Step {item.number}</small>
              <strong>{item.label}</strong>
            </div>
          </li>
        ))}
        <li className={reviewing ? "active" : ""}>
          <span>{reviewing ? 4 : <CheckCircle2 size={15} />}</span>
          <div>
            <small>Final check</small>
            <strong>Review</strong>
          </div>
        </li>
      </ol>

      {reviewing ? (
        <section className="listing-review" aria-live="polite">
          {assistantNote && (
            <div className="assistant-note">
              <Sparkles size={15} />
              <p>{assistantNote}</p>
            </div>
          )}
          <section>
            <span>Work</span>
            <h2>{title}</h2>
            <p>{description}</p>
            <dl>
              <div>
                <dt>Category</dt>
                <dd>{category.toLowerCase()}</dd>
              </div>
              <div>
                <dt>Skills</dt>
                <dd>{skillItems.join(", ")}</dd>
              </div>
            </dl>
          </section>
          <section>
            <span>Milestone structure</span>
            <ol className="listing-review-milestones">
              {milestones.map((milestone, index) => (
                <li key={milestone.id}>
                  <b>{index + 1}</b>
                  <div>
                    <h3>{milestone.title}</h3>
                    <p>
                      <strong>What will be delivered?</strong>
                      {milestone.deliverable}
                    </p>
                    <p>
                      <strong>How will success be confirmed?</strong>
                      {milestone.acceptanceCriteria}
                    </p>
                    <p>
                      <strong>What proof should be provided?</strong>
                      {milestone.evidenceRequirements}
                    </p>
                  </div>
                  <time>Day {milestone.deliveryDays}</time>
                </li>
              ))}
            </ol>
          </section>
          <section>
            <span>Terms</span>
            <dl className="listing-review-terms">
              <div>
                <dt>Minimum budget</dt>
                <dd>{budgetMin} CKB</dd>
              </div>
              <div>
                <dt>Maximum budget</dt>
                <dd>{budgetMax} CKB</dd>
              </div>
              <div>
                <dt>Proposal deadline</dt>
                <dd>{new Date(`${proposalDeadline}T12:00:00`).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt>Expected timing</dt>
                <dd>{milestones.at(-1)?.deliveryDays} days</dd>
              </div>
            </dl>
          </section>
          {error && (
            <p className="form-feedback error" role="alert">
              {error}
            </p>
          )}
          {draftId && (
            <p className="form-feedback success">
              Your draft was saved, but publishing did not complete. You can retry or edit the
              draft.
            </p>
          )}
          <div className="wizard-actions">
            <button type="button" className="secondary-button" onClick={editDraft} disabled={busy}>
              <Pencil size={16} /> Edit job
            </button>
            <button type="button" className="primary-button" onClick={publish} disabled={busy}>
              <Send size={16} />{" "}
              {busy ? (draftId ? "Publishing..." : "Creating draft...") : "Publish job"}
            </button>
          </div>
        </section>
      ) : (
        <form className="form-panel listing-form" onSubmit={(event) => event.preventDefault()}>
          <div className="form-title listing-form-title">
            <span>
              <BriefcaseBusiness size={19} />
            </span>
            <div>
              <h2>{stages[stage - 1].label}</h2>
              <p>Step {stage} of 3</p>
            </div>
          </div>

          {stage === 1 && (
            <div className="listing-stage">
              <div className="assistant-start">
                <label>
                  Scope and expected outcome
                  <textarea
                    value={description}
                    aria-invalid={Boolean(error) && description.trim().length < 40}
                    onChange={(event) => setDescription(event.target.value)}
                    minLength={40}
                    maxLength={5000}
                    rows={7}
                    placeholder="Describe the work, expected outcome, important constraints, and what success should look like."
                  />
                  {error && description.trim().length < 40 && (
                    <small className="field-error">
                      Describe the outcome in at least 40 characters.
                    </small>
                  )}
                </label>
                <div className="assistant-row">
                  <small>Start with a rough brief or complete every field manually.</small>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={assist}
                    disabled={assistantBusy}
                  >
                    <Sparkles size={15} />{" "}
                    {assistantBusy ? "Preparing..." : "Build from description"}
                  </button>
                </div>
              </div>
              {assistantNote && (
                <div className="assistant-note">
                  <Sparkles size={15} />
                  <p>{assistantNote}</p>
                </div>
              )}
              <label>
                Job title
                <input
                  value={title}
                  aria-invalid={Boolean(error) && title.trim().length < 5}
                  onChange={(event) => setTitle(event.target.value)}
                  minLength={5}
                  maxLength={90}
                />
              </label>
              <div className="two-fields">
                <label>
                  Category
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value as typeof category)}
                  >
                    {JOB_CATEGORIES.map((item) => (
                      <option value={item} key={item}>
                        {item.toLowerCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Skills
                  <input
                    value={skills}
                    onChange={(event) => setSkills(event.target.value)}
                    placeholder="React, product design, research"
                  />
                  <small>Separate skills with commas.</small>
                </label>
              </div>
            </div>
          )}

          {stage === 2 && (
            <div className="listing-stage">
              <div className="listing-milestones-heading">
                <h2>Verifiable milestone expectations</h2>
                <p>Make each outcome and approval decision clear to both sides.</p>
              </div>
              <div className="listing-milestone-editors">
                {milestones.map((milestone, index) => (
                  <fieldset key={milestone.id}>
                    <legend>Milestone {index + 1}</legend>
                    {milestones.length > 1 && (
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={() =>
                          setMilestones((items) => items.filter((item) => item.id !== milestone.id))
                        }
                        aria-label={`Remove milestone ${index + 1}`}
                        title="Remove milestone"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
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
                        Delivery time
                        <div className="duration-input">
                          <input
                            type="number"
                            min={index ? milestones[index - 1].deliveryDays + 1 : 1}
                            max={365}
                            value={milestone.deliveryDays}
                            onChange={(event) =>
                              updateMilestone(
                                milestone.id,
                                "deliveryDays",
                                Number(event.target.value),
                              )
                            }
                          />
                          <span>days</span>
                        </div>
                      </label>
                    </div>
                    <label>
                      What will be delivered?
                      <textarea
                        rows={3}
                        value={milestone.deliverable}
                        onChange={(event) =>
                          updateMilestone(milestone.id, "deliverable", event.target.value)
                        }
                        placeholder="Describe the concrete outcome the professional should provide."
                      />
                      <small>Formal term: deliverable</small>
                    </label>
                    <label>
                      How will success be confirmed?
                      <textarea
                        rows={3}
                        value={milestone.acceptanceCriteria}
                        onChange={(event) =>
                          updateMilestone(milestone.id, "acceptanceCriteria", event.target.value)
                        }
                        placeholder="State the objective conditions used to approve this milestone."
                      />
                      <small>Formal term: acceptance criteria</small>
                    </label>
                    <label>
                      What proof should be provided?
                      <input
                        value={milestone.evidenceRequirements}
                        onChange={(event) =>
                          updateMilestone(milestone.id, "evidenceRequirements", event.target.value)
                        }
                        placeholder="Working URL, source commit, report, or completion recording"
                      />
                      <small>Formal term: required proof</small>
                    </label>
                  </fieldset>
                ))}
                <button
                  type="button"
                  className="secondary-button"
                  disabled={milestones.length >= 10}
                  onClick={() =>
                    setMilestones((items) => [
                      ...items,
                      blankMilestone((items.at(-1)?.deliveryDays ?? 0) + 7),
                    ])
                  }
                >
                  <Plus size={15} /> Add milestone <span>{milestones.length}/10</span>
                </button>
              </div>
            </div>
          )}

          {stage === 3 && (
            <div className="listing-stage">
              <div className="listing-terms-intro">
                <h3>Set a realistic range and response window</h3>
                <p>Professionals will propose milestone amounts within these terms.</p>
              </div>
              <div className="three-fields listing-commercial-fields">
                <label>
                  Minimum budget (CKB)
                  <input
                    value={budgetMin}
                    onChange={(event) => setBudgetMin(event.target.value)}
                    type="number"
                    min="0.00000001"
                    step="0.00000001"
                  />
                </label>
                <label>
                  Maximum budget (CKB)
                  <input
                    value={budgetMax}
                    onChange={(event) => setBudgetMax(event.target.value)}
                    type="number"
                    min="0.00000001"
                    step="0.00000001"
                  />
                </label>
                <label>
                  Proposal deadline
                  <input
                    value={proposalDeadline}
                    onChange={(event) => setProposalDeadline(event.target.value)}
                    type="date"
                    min={minimumDeadline}
                  />
                </label>
              </div>
              <div className="terms-summary">
                <CheckCircle2 size={18} />
                <div>
                  <strong>Review before publishing</strong>
                  <p>Your job remains private until you confirm it on the next screen.</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="form-feedback error" role="alert">
              {error}
            </p>
          )}
          {saved && !error && !workDirty && <p className="form-feedback success">Draft saved.</p>}
          <div className="wizard-actions">
            <button type="button" className="secondary-button" onClick={saveDraft} disabled={busy}>
              {busy ? "Saving..." : "Save draft"}
            </button>
            {stage === 1 ? (
              <Link className="secondary-button" href="/jobs/new">
                Cancel
              </Link>
            ) : (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setError("");
                  setStage((stage - 1) as Stage);
                }}
              >
                <ArrowLeft size={16} /> Back
              </button>
            )}
            {stage < 3 ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => continueTo((stage + 1) as Stage)}
              >
                Continue <ArrowRight size={16} />
              </button>
            ) : (
              <button type="button" className="primary-button" onClick={openReview}>
                Review job <CheckCircle2 size={16} />
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
