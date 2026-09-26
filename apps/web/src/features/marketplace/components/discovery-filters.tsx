"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Filter, Search, X } from "lucide-react";

export function DiscoveryFilters({
  children,
  query,
  count,
}: {
  children: React.ReactNode;
  query?: string;
  count: number;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = Array.from(params.entries()).filter(
    ([key, value]) =>
      !["cursor", "sort", "limit"].includes(key) &&
      value !== "" &&
      !(key === "minCompletedJobs" && value === "0"),
  );
  return (
    <>
      <form className="discovery-filters" action={pathname}>
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            name="query"
            aria-label="Search marketplace"
            defaultValue={query}
            placeholder="Search by name, work, or skill"
          />
        </label>
        <button className="primary-button" type="submit">
          Search
        </button>
        <details className="discovery-filter-options">
          <summary>
            <Filter size={17} aria-hidden="true" /> Filters
            {active.length ? ` (${active.length})` : ""}
          </summary>
          <div className="discovery-filter-fields">
            {children}
            <button className="primary-button" type="submit">
              Apply filters
            </button>
          </div>
        </details>
      </form>
      <div className="discovery-results-bar">
        <p role="status">
          {count} {count === 1 ? "result" : "results"} on this page
        </p>
        {active.map(([key, value]) => {
          const next = new URLSearchParams(params.toString());
          next.delete(key);
          next.delete("cursor");
          return (
            <Link
              className="filter-chip"
              href={`${pathname}?${next}`}
              key={key}
              aria-label={`Remove ${key} filter: ${value}`}
            >
              {key === "minCompletedJobs"
                ? `${value}+ completed jobs`
                : `${key === "query" ? "Search" : key.charAt(0).toUpperCase() + key.slice(1)}: ${value.replaceAll("_", " ")}`}
              <X size={14} aria-hidden="true" />
            </Link>
          );
        })}
        {active.length > 0 && (
          <Link className="clear-filters" href={pathname}>
            Clear filters
          </Link>
        )}
      </div>
    </>
  );
}
