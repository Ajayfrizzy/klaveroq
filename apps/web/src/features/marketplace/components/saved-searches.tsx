"use client";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { preferenceRequest, useAccountPreferences } from "@/features/preferences/client";

export function SavedSearches({ scope }: { scope: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const authenticated = scope !== "guest";
  const { data, error, reload } = useAccountPreferences(authenticated);
  const searches =
    data?.searches.filter(
      (s) => `/${s.scope}` === (pathname === "/jobs" ? "/discover" : pathname),
    ) ?? [];
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  if (!authenticated)
    return (
      <Link
        className="public-save-link"
        href={`/login?returnTo=${encodeURIComponent(`${pathname}?${params}`)}`}
      >
        Sign in to save searches
      </Link>
    );
  return (
    <details className="saved-searches">
      <summary>Saved searches ({searches.length})</summary>
      <p>Save filters to your account. Saved searches do not send notifications.</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const next = new URLSearchParams(params.toString());
          next.delete("cursor");
          setBusy(true);
          setMessage("");
          try {
            await preferenceRequest("/saved-searches", "POST", {
              scope: pathname === "/jobs" ? "discover" : pathname.slice(1),
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
        <button className="secondary-button" disabled={busy || !data || !name.trim()}>
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
