"use client";
import { useCallback, useEffect, useState } from "react";
import { focusSchema, savedSearchSchema, importSchema, type AccountPreferences } from "./schema";

export async function preferenceRequest(
  path = "",
  method = "GET",
  input?: unknown,
): Promise<AccountPreferences> {
  const response = await fetch(`/api/preferences${path}`, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: input === undefined ? undefined : JSON.stringify(input),
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error?.message ?? "Preferences could not be saved. Please try again.");
  if (method !== "GET") window.dispatchEvent(new Event("preferences:changed"));
  return body.data;
}
export function useAccountPreferences(enabled: boolean) {
  const [data, setData] = useState<AccountPreferences | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    if (!enabled) return;
    try {
      setData(await preferenceRequest());
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Preferences could not be loaded. Try again.",
      );
    }
  }, [enabled]);
  useEffect(() => {
    const timer = setTimeout(() => void reload(), 0);
    const refresh = () => void reload();
    window.addEventListener("preferences:changed", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("preferences:changed", refresh);
    };
  }, [reload]);
  return { data, error, reload };
}

export function legacyPreferences(userId: string, server: AccountPreferences) {
  const input: {
    workspaceFocus?: "hire" | "work" | "both";
    searches: unknown[];
    talentIds: string[];
  } = { searches: [], talentIds: [] };
  const keys: { key: string; value: string }[] = [];
  const read = (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const focusKey = `klaveroq:intent:${userId}`;
  const focusValue = read(focusKey);
  const focus = focusSchema.safeParse(focusValue);
  if (!server.hasWorkspaceFocus && focus.success && focusValue !== null) {
    input.workspaceFocus = focus.data;
    keys.push({ key: focusKey, value: focusValue });
  }
  for (const scope of ["discover", "talent"] as const) {
    if (server.searches.some((search) => search.scope === scope)) continue;
    const key = `klaveroq:searches:${userId}:/${scope}`;
    const value = read(key);
    try {
      const rows: unknown = JSON.parse(value ?? "null");
      if (!Array.isArray(rows) || !rows.length || rows.length > 8) continue;
      const parsed = rows.map((row) => {
        if (!row || typeof row.url !== "string" || !row.url.startsWith(`/${scope}?`))
          throw new Error("Invalid legacy search");
        const url = new URL(row.url, "https://klaveroq.invalid");
        if (url.origin !== "https://klaveroq.invalid" || url.pathname !== `/${scope}` || url.hash)
          throw new Error("Invalid legacy URL");
        url.searchParams.delete("cursor");
        if (new Set(url.searchParams.keys()).size !== [...url.searchParams.keys()].length)
          throw new Error("Duplicate parameters");
        return savedSearchSchema.parse({
          scope,
          name: row.name,
          parameters: Object.fromEntries(url.searchParams),
        });
      });
      input.searches.push(...parsed);
      keys.push({ key, value: value! });
    } catch {
      /* Malformed device data is never imported. */
    }
  }
  const key = `klaveroq:shortlist:${userId}`;
  const value = read(key);
  if (!server.talentIds.length) {
    try {
      const parsed = importSchema.shape.talentIds.parse(JSON.parse(value ?? "null"));
      if (parsed.length && !parsed.includes(userId)) {
        input.talentIds = [...new Set(parsed)];
        keys.push({ key, value: value! });
      }
    } catch {
      /* Ignore malformed device data. */
    }
  }
  return { input, keys };
}

export function DevicePreferenceImport({ userId }: { userId: string }) {
  const [legacy, setLegacy] = useState<ReturnType<typeof legacyPreferences> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void preferenceRequest()
      .then((server) => {
        try {
          if (sessionStorage.getItem(`klaveroq:import-declined:${userId}`)) return;
        } catch {
          /* In-memory dismissal still works. */
        }
        if (active) setLegacy(legacyPreferences(userId, server));
      })
      .catch(() => {
        /* Existing controls surface load failures and retry. */
      });
    return () => {
      active = false;
    };
  }, [userId]);
  if (!legacy?.keys.length) return null;
  return (
    <section className="panel" aria-label="Import device preferences">
      <p>Preferences from this device were found. Save them to your Klaveroq account?</p>
      <button
        className="primary-button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await preferenceRequest("/import", "POST", legacy.input);
            for (const { key, value } of legacy.keys) {
              try {
                if (localStorage.getItem(key) === value) localStorage.removeItem(key);
              } catch {
                /* Successful imports are deduplicated on retry. */
              }
            }
            setLegacy(null);
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Import failed. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Save to my account
      </button>{" "}
      <button
        className="secondary-button"
        disabled={busy}
        onClick={() => {
          try {
            sessionStorage.setItem(`klaveroq:import-declined:${userId}`, "1");
          } catch {
            /* Keep the data untouched. */
          }
          setLegacy(null);
        }}
      >
        Not now
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
