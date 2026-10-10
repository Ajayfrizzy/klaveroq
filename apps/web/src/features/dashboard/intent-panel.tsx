"use client";

import { useState } from "react";
import { preferenceRequest, useAccountPreferences } from "@/features/preferences/client";
import Link from "next/link";

export function IntentPanel({
  profileReady,
  published,
  hasHistory = false,
}: {
  userId: string;
  profileReady: boolean;
  published: boolean;
  hasHistory?: boolean;
}) {
  const { data, error: loadError, reload } = useAccountPreferences(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  if (loadError && !data)
    return (
      <section className="intent-panel" aria-label="Your workspace">
        <h2>Your workspace</h2>
        <p role="status">Workspace recommendations are temporarily unavailable.</p>
        <button className="secondary-button" onClick={() => void reload()}>
          Retry loading preferences
        </button>
      </section>
    );
  const intent = choice ?? data?.workspaceFocus ?? "both";
  const compact = Boolean(data?.hasWorkspaceFocus && (profileReady || hasHistory));
  const workLabel = !profileReady
    ? "Complete profile"
    : !published
      ? "Publish profile"
      : "Find work";
  return (
    <section
      className={`intent-panel${profileReady && published ? " intent-complete" : ""}`}
      aria-labelledby="intent-title"
    >
      {compact && (
        <div className="intent-current">
          <p id="intent-title">
            Current focus:{" "}
            <strong>
              {intent === "hire" ? "Hire talent" : intent === "work" ? "Find work" : "Both"}
            </strong>
          </p>
          <button
            type="button"
            className="secondary-button"
            aria-expanded={expanded}
            aria-controls="workspace-focus-options"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Done" : "Change"}
          </button>
        </div>
      )}
      <div id="workspace-focus-options" hidden={compact && !expanded}>
        {!compact && (
          <>
            <p className="eyebrow">Your workspace</p>
            <h2 id="intent-title">Your next step</h2>
          </>
        )}
        <div className="intent-options" role="group" aria-label="Workspace focus">
          {[
            ["hire", "Hire talent", "Post a brief and choose a professional"],
            ["work", "Find work", "Build your profile and send proposals"],
            ["both", "Both", "Hire and work from one account"],
          ].map(([value, label, description]) => (
            <button
              key={value}
              type="button"
              className="secondary-button"
              aria-pressed={intent === value}
              aria-label={label}
              disabled={!data || busy}
              onClick={async () => {
                setExpanded(true);
                setBusy(true);
                setError("");
                setChoice(value);
                try {
                  await preferenceRequest("", "PATCH", { workspaceFocus: value });
                  await reload();
                } catch (reason) {
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : "Could not save your preference. Try again.",
                  );
                } finally {
                  setChoice(null);
                  setBusy(false);
                }
              }}
            >
              <strong>{label}</strong>
              <span className="sr-only">{description}</span>
            </button>
          ))}
        </div>
        <p>
          {intent === "hire"
            ? "Post your brief, compare proposals, then agree on milestones."
            : intent === "work"
              ? "Publish your profile, find suitable work, and send a proposal."
              : "Hire professionals or build your own work history. Switch your focus anytime."}
        </p>
        <div className="intent-options">
          {intent !== "work" && (
            <Link className="primary-button" href="/jobs/new/public">
              Post a job
            </Link>
          )}
          {intent !== "hire" && (
            <Link
              className={intent === "work" ? "primary-button" : "secondary-button"}
              href={profileReady && published ? "/discover" : "/profile"}
            >
              {workLabel}
            </Link>
          )}
          <Link className="secondary-button" href={intent === "work" ? "/discover" : "/talent"}>
            {intent === "work" ? "Browse opportunities" : "Find talent"}
          </Link>
        </div>
      </div>
      {(error || loadError) && (
        <p role="alert">
          {error || loadError}{" "}
          <button className="secondary-button" onClick={() => void reload()}>
            Retry loading preferences
          </button>
        </p>
      )}
    </section>
  );
}
