"use client";
import { useId, useState } from "react";
import { X } from "lucide-react";

export function TagInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const id = useId();
  const [entry, setEntry] = useState("");
  const tags = value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const commit = () => {
    const next = [...tags];
    for (const tag of entry
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)) {
      if (!next.some((item) => item.toLowerCase() === tag.toLowerCase())) next.push(tag);
    }
    onChange(next.join(", "));
    setEntry("");
  };
  return (
    <div className="tag-field">
      <label htmlFor={id}>{label}</label>
      <div className="tag-values">
        {tags.map((tag) => (
          <span key={tag}>
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(tags.filter((item) => item !== tag).join(", "))}
            >
              <X size={14} />
            </button>
          </span>
        ))}
      </div>
      <div className="tag-entry">
        <input
          id={id}
          value={entry}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-help`}
          onChange={(event) => setEntry(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === ",") && !event.nativeEvent.isComposing) {
              event.preventDefault();
              commit();
            }
          }}
        />
        <button type="button" className="secondary-button" onClick={commit}>
          Add
        </button>
      </div>
      <small id={`${id}-help`}>{error || "Type an item and press Enter to add it."}</small>
    </div>
  );
}
