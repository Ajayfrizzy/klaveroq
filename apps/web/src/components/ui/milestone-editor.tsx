"use client";

import { useState, type ReactNode } from "react";

/** Native disclosure keeps editors keyboard accessible and values mounted when closed. */
export function MilestoneEditor({
  index,
  title,
  summary,
  children,
}: {
  index: number;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  const [initiallyOpen] = useState(index === 0 || !title);
  return (
    <details className="milestone-disclosure" open={initiallyOpen}>
      <summary>
        <span className="milestone-disclosure-number">{index + 1}</span>
        <span>
          <strong>{title || `Milestone ${index + 1}`}</strong>
          <small>{summary}</small>
        </span>
        <span className="milestone-disclosure-hint">Edit</span>
      </summary>
      <div className="milestone-disclosure-body">{children}</div>
    </details>
  );
}
