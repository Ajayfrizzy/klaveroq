"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { preferenceRequest, useAccountPreferences } from "@/features/preferences/client";

type Talent = {
  profile: {
    userId: string;
    displayName: string;
    skills: string[];
    timezone: string | null;
    availability: string;
    headline: string | null;
  };
  reputation: {
    averageRating: number | null;
    reviewCount: number;
    completedJobs: number;
    identityVerified: boolean;
  };
};
const Selection = createContext<{ ids: string[]; disabled: boolean; toggle: (id: string) => void }>(
  {
    ids: [],
    disabled: true,
    toggle: () => {},
  },
);

export function TalentTools({ scope, children }: { scope: string; children: React.ReactNode }) {
  if (scope === "guest") return <>{children}</>;
  return <AccountTalentTools>{children}</AccountTalentTools>;
}

function AccountTalentTools({ children }: { children: React.ReactNode }) {
  const { data, error, reload } = useAccountPreferences(true);
  const ids = data?.talentIds ?? [];
  const ready = Boolean(data);
  const [message, setMessage] = useState("");
  const [comparison, setComparison] = useState<(Talent | null)[] | null>(null);
  const [busy, setBusy] = useState(false);
  const toggle = async (id: string) => {
    if (!ready || busy) return;
    if (!ids.includes(id) && ids.length === 3) {
      setMessage("Compare up to 3 people. Remove someone before adding another.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await preferenceRequest("/talent-shortlist", ids.includes(id) ? "DELETE" : "POST", {
        talentUserId: id,
      });
      await reload();
      setComparison(null);
      setMessage("Shortlist saved to your account.");
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "Shortlist could not be saved. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const compare = async () => {
    setBusy(true);
    setMessage("");
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          const response = await fetch(`/api/talent/${id}`, { cache: "no-store" });
          if (response.status === 404) return null;
          if (!response.ok) throw new Error("Could not load the comparison. Try again.");
          return (await response.json()).data as Talent;
        }),
      );
      setComparison(results);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load the comparison.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Selection.Provider value={{ ids, toggle, disabled: !ready || busy }}>
      {error && (
        <p role="alert">
          {error}{" "}
          <button className="secondary-button" onClick={() => void reload()}>
            Retry loading shortlist
          </button>
        </p>
      )}
      {(ids.length > 0 || message) && (
        <section className="hiring-tools" aria-label="Talent shortlist">
          <div>
            <strong>Shortlist · {ids.length}/3</strong>
            <p>Saved to your account. Compare current public profiles side by side.</p>
          </div>
          <button
            className="secondary-button"
            disabled={!ready || !ids.length || busy}
            onClick={compare}
          >
            {busy ? "Loading profiles…" : "View shortlist & compare"}
          </button>
          {message && <p role="status">{message}</p>}
          {comparison && (
            <div
              className="talent-comparison"
              role="region"
              aria-label="Profile comparison"
              tabIndex={0}
            >
              <table>
                <caption>Verified history and professional details</caption>
                <thead>
                  <tr>
                    <th scope="col">Compare</th>
                    {ids.map((id, index) => (
                      <th scope="col" key={id}>
                        {comparison[index]?.profile.displayName ?? "Profile no longer available"}
                        <button
                          className="secondary-button"
                          disabled={busy}
                          onClick={() => toggle(id)}
                          aria-label={`Remove ${comparison[index]?.profile.displayName ?? "unavailable profile"} from shortlist`}
                        >
                          Remove
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    [
                      "Identity verification",
                      (person: Talent) =>
                        person.reputation.identityVerified ? "Verified" : "Not verified",
                    ],
                    [
                      "Verified reviews",
                      (person: Talent) =>
                        person.reputation.averageRating === null
                          ? "No reviews yet"
                          : `${person.reputation.averageRating.toFixed(1)} / 5 (${person.reputation.reviewCount} reviews)`,
                    ],
                    [
                      "Completed Klaveroq jobs",
                      (person: Talent) => String(person.reputation.completedJobs),
                    ],
                    [
                      "Skills · self-reported",
                      (person: Talent) => person.profile.skills.join(", ") || "Not provided",
                    ],
                    [
                      "Availability · self-reported",
                      (person: Talent) => person.profile.availability.toLowerCase(),
                    ],
                    [
                      "Timezone · self-reported",
                      (person: Talent) => person.profile.timezone || "Not provided",
                    ],
                  ].map(([label, getValue]) => (
                    <tr key={label as string}>
                      <th scope="row">{label as string}</th>
                      {ids.map((id, index) => (
                        <td key={id}>
                          {comparison[index]
                            ? (getValue as (p: Talent) => string)(comparison[index]!)
                            : "No longer public"}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">Profile</th>
                    {ids.map((id, index) => (
                      <td key={id}>
                        {comparison[index] && (
                          <Link className="secondary-button" href={`/talent/${id}`}>
                            View profile
                          </Link>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
              <button className="secondary-button" onClick={() => setComparison(null)}>
                Close comparison
              </button>
            </div>
          )}
        </section>
      )}
      {children}
    </Selection.Provider>
  );
}

export function ShortlistButton({ id, name }: { id: string; name: string }) {
  const selection = useContext(Selection);
  return (
    <button
      type="button"
      disabled={selection.disabled}
      className="secondary-button"
      aria-pressed={selection.ids.includes(id)}
      aria-label={`Shortlist ${name}`}
      onClick={() => selection.toggle(id)}
    >
      {selection.ids.includes(id) ? "Shortlisted" : "Shortlist"}
    </button>
  );
}

export function TimezoneContext({ timezone }: { timezone: string | null }) {
  const [description, setDescription] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!timezone) return;
      try {
        const offset = (zone: string) => {
          const text =
            new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
              .formatToParts(new Date())
              .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
          const match = text.match(/GMT([+-])(\d{2}):(\d{2})/);
          return match
            ? (Number(match[2]) * 60 + Number(match[3])) * (match[1] === "+" ? 1 : -1)
            : 0;
        };
        const delta = offset(timezone) - offset(Intl.DateTimeFormat().resolvedOptions().timeZone);
        setDescription(
          delta === 0
            ? "Same UTC offset as you today"
            : `${Math.abs(delta) / 60}h ${delta > 0 ? "ahead of" : "behind"} you today`,
        );
      } catch {
        setDescription("Timezone comparison unavailable");
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [timezone]);
  return description ? <small className="timezone-context">{description}</small> : null;
}
