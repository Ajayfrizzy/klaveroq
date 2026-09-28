"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function IntentPanel({
  userId,
  profileReady,
  published,
}: {
  userId: string;
  profileReady: boolean;
  published: boolean;
}) {
  const [intent, setIntent] = useState("both");
  const key = `klaveroq:intent:${userId}`;
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem(key);
        if (saved && ["hire", "work", "both"].includes(saved)) setIntent(saved);
      } catch {
        /* Preference is optional. */
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [key]);
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
      <p className="eyebrow">Your workspace</p>
      <h2 id="intent-title">What would you like to do?</h2>
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
            onClick={() => {
              setIntent(value);
              try {
                localStorage.setItem(key, value);
              } catch {
                /* Keep the current choice. */
              }
            }}
          >
            <strong>{label}</strong>
            <small>{description}</small>
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
            className={intent === "work" || !profileReady ? "primary-button" : "secondary-button"}
            href={profileReady && published ? "/discover" : "/profile"}
          >
            {workLabel}
          </Link>
        )}
        <Link className="secondary-button" href={intent === "work" ? "/discover" : "/talent"}>
          {intent === "work" ? "Browse opportunities" : "Find talent"}
        </Link>
      </div>
      <small>Your focus is remembered on this device.</small>
    </section>
  );
}
