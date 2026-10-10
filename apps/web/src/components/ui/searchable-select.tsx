"use client";
import { useId, useState } from "react";

export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  invalid,
  filterLabel = "Filter available locations",
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
  invalid?: boolean;
  filterLabel?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const filtered = options.filter(
    ([code, name]) =>
      code === value || `${code} ${name}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="searchable-select">
      <label htmlFor={`${id}-search`}>
        {filterLabel}
        <input
          id={`${id}-search`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Type to filter ${label.toLowerCase()}`}
        />
      </label>
      <label htmlFor={id}>
        {label}
        <select
          id={id}
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid}
        >
          <option value="">Not specified</option>
          {value && !options.some(([code]) => code === value) && (
            <option value={value}>{value}</option>
          )}
          {filtered.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <small role="status">
        {filtered.length} {filtered.length === 1 ? "option" : "options"}
      </small>
    </div>
  );
}
