"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { preferenceRequest, useAccountPreferences } from "@/features/preferences/client";

type SavedSearch = { id?: string; name: string; url: string };
export function SavedSearches({ scope }: { scope: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const key = `klaveroq:searches:${scope}:${pathname}`;
  const authenticated = scope !== "guest";
  const { data, error, reload } = useAccountPreferences(authenticated);
  const [localSearches, setSearches] = useState<SavedSearch[]>([]);
  const searches = authenticated
    ? (data?.searches.filter((s) => `/${s.scope}` === pathname) ?? [])
    : localSearches;
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (authenticated) return;
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
  }, [key, pathname, authenticated]);
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
      <p>
        {authenticated ? "Save filters to your account." : "Save filters on this device."} Saved
        searches do not send notifications.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const next = new URLSearchParams(params.toString());
          next.delete("cursor");
          const url = `${pathname}?${next}`;
          if (authenticated) {
            setBusy(true);
            setMessage("");
            try {
              await preferenceRequest("/saved-searches", "POST", {
                scope: pathname.slice(1),
                name: name.trim(),
                parameters: Object.fromEntries(next),
              });
              await reload();
              setName("");
              setMessage("Search saved to your account.");
            } catch (reason) {
              setMessage(
                reason instanceof Error ? reason.message : "Search could not be saved. Try again.",
              );
            } finally {
              setBusy(false);
            }
            return;
          }
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
        <button
          className="secondary-button"
          disabled={busy || !(authenticated ? data : ready) || !name.trim()}
        >
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
              disabled={busy}
              onClick={async () => {
                if (!authenticated) {
                  persist(searches.filter((item) => item.url !== search.url));
                  return;
                }
                setBusy(true);
                try {
                  await preferenceRequest("/saved-searches", "DELETE", { id: search.id });
                  await reload();
                  setMessage("Saved search removed.");
                } catch (reason) {
                  setMessage(
                    reason instanceof Error
                      ? reason.message
                      : "Could not remove search. Try again.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <p role="status">{message}</p>
      {error && (
        <p role="alert">
          {error}{" "}
          <button className="secondary-button" onClick={() => void reload()}>
            Retry loading searches
          </button>
        </p>
      )}
    </details>
  );
}
