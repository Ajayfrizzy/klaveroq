"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";

type SavedSearch = { name: string; url: string };
export function SavedSearches({ scope }: { scope: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const key = `klaveroq:searches:${scope}:${pathname}`;
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored: unknown = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(stored))
          setSearches(
            stored
              .filter((item): item is SavedSearch =>
                Boolean(
                  item &&
                  typeof item.name === "string" &&
                  typeof item.url === "string" &&
                  item.url.startsWith(`${pathname}?`),
                ),
              )
              .slice(0, 8),
          );
      } catch {
        /* Optional local preference. */
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [key, pathname]);
  const persist = (next: SavedSearch[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setSearches(next);
      setMessage("Saved searches updated on this device.");
    } catch {
      setMessage("Your browser could not save this search. Try allowing local storage.");
    }
  };
  return (
    <details className="saved-searches">
      <summary>Saved searches ({searches.length})</summary>
      <p>Save filters on this device. Saved searches do not send notifications.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams(params.toString());
          next.delete("cursor");
          const url = `${pathname}?${next}`;
          persist(
            [...searches.filter((search) => search.url !== url), { name: name.trim(), url }].slice(
              -8,
            ),
          );
          setName("");
        }}
      >
        <label>
          Search name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={60}
            placeholder="e.g. Available designers"
          />
        </label>
        <button className="secondary-button" disabled={!ready || !name.trim()}>
          Save current search
        </button>
      </form>
      <ul>
        {searches.map((search) => (
          <li key={search.url}>
            <Link href={search.url}>{search.name}</Link>
            <button
              type="button"
              className="secondary-button"
              aria-label={`Remove saved search ${search.name}`}
              onClick={() => persist(searches.filter((item) => item.url !== search.url))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <p role="status">{message}</p>
    </details>
  );
}
