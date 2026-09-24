"use client";

import { JOB_CATEGORIES } from "@klaveroq/domain";
import {
  Check,
  Circle,
  ExternalLink,
  Eye,
  EyeOff,
  Github,
  Globe2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Profile = {
  userId: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  primaryRole: string | null;
  skills: string[];
  experienceLevel: string | null;
  yearsExperience: number | null;
  languages: string[];
  availability: "AVAILABLE" | "LIMITED" | "UNAVAILABLE";
  preferredWorkCategories: string[];
  countryCode: string | null;
  timezone: string;
  githubUrl: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  isPublic: boolean;
};

type PortfolioItem = {
  id: string;
  title: string;
  description: string;
  projectUrl: string | null;
  githubUrl: string | null;
  skills: string[];
  projectRole: string | null;
};

const commaList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

async function responseBody(response: Response) {
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) return null;
  try {
    return (await response.json()) as {
      data?: Profile | PortfolioItem;
      error?: { message?: string };
    };
  } catch {
    return null;
  }
}

const emptyPortfolio = {
  title: "",
  description: "",
  projectUrl: "",
  githubUrl: "",
  skills: "",
  projectRole: "",
};

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const countries = Array.from({ length: 26 * 26 }, (_, index) => {
  const code = `${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}`;
  const name = regionNames.of(code);
  return name && name !== code ? ([code, name] as const) : null;
})
  .filter((item): item is readonly [string, string] => Boolean(item))
  .sort((left, right) => left[1].localeCompare(right[1]));

const commonTimezones = [
  "Africa/Accra",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "America/Chicago",
  "America/Los_Angeles",
  "America/New_York",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
  "Europe/Berlin",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Paris",
  "UTC",
];

export function ProfileEditor({
  initialProfile,
  initialPortfolio,
}: {
  initialProfile: Profile;
  initialPortfolio: PortfolioItem[];
}) {
  const router = useRouter();
  const [savedProfile, setSavedProfile] = useState(initialProfile);
  const [profile, setProfile] = useState(initialProfile);
  const [skillsText, setSkillsText] = useState(initialProfile.skills.join(", "));
  const [languagesText, setLanguagesText] = useState(initialProfile.languages.join(", "));
  const [portfolio, setPortfolio] = useState(initialPortfolio);
  const [editing, setEditing] = useState(false);
  const [portfolioForm, setPortfolioForm] = useState(emptyPortfolio);
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [showPortfolioForm, setShowPortfolioForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setProfile((current) => ({ ...current, [key]: value }));
  const readiness = [
    { label: "Display name", complete: Boolean(profile.displayName.trim()) },
    {
      label: "Professional headline or primary role",
      complete: Boolean(profile.headline?.trim() || profile.primaryRole?.trim()),
    },
    { label: "Bio", complete: Boolean(profile.bio?.trim()) },
    { label: "At least one skill", complete: profile.skills.some((skill) => skill.trim()) },
  ];
  const readyCount = readiness.filter((item) => item.complete).length;
  const profileReady = readyCount === readiness.length;

  const cancelProfileEdit = () => {
    setProfile(savedProfile);
    setSkillsText(savedProfile.skills.join(", "));
    setLanguagesText(savedProfile.languages.join(", "));
    setEditing(false);
    setFeedback("");
    setFeedbackIsError(false);
  };

  const cancelPortfolioEdit = () => {
    setPortfolioId(null);
    setPortfolioForm(emptyPortfolio);
    setShowPortfolioForm(false);
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    setFeedbackIsError(false);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          headline: profile.headline ?? "",
          bio: profile.bio ?? "",
          primaryRole: profile.primaryRole ?? "",
          experienceLevel: profile.experienceLevel ?? "INTERMEDIATE",
          countryCode: profile.countryCode ?? "",
          skills: commaList(skillsText),
          languages: commaList(languagesText),
        }),
      });
      const body = await responseBody(response);
      if (!response.ok || !body?.data) {
        setFeedbackIsError(true);
        setFeedback(body?.error?.message ?? "Profile could not be saved. Please try again.");
        return;
      }
      const updated = body.data as Profile;
      setSavedProfile(updated);
      setProfile(updated);
      setSkillsText(updated.skills.join(", "));
      setLanguagesText(updated.languages.join(", "));
      setEditing(false);
      setFeedback("Profile saved.");
      router.refresh();
    } catch {
      setFeedbackIsError(true);
      setFeedback("Profile could not be saved. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const editPortfolio = (item: PortfolioItem) => {
    setPortfolioId(item.id);
    setPortfolioForm({
      title: item.title,
      description: item.description,
      projectUrl: item.projectUrl ?? "",
      githubUrl: item.githubUrl ?? "",
      skills: item.skills.join(", "),
      projectRole: item.projectRole ?? "",
    });
    setShowPortfolioForm(true);
  };

  const savePortfolio = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    setFeedbackIsError(false);
    try {
      const response = await fetch(
        portfolioId ? `/api/profile/portfolio/${portfolioId}` : "/api/profile/portfolio",
        {
          method: portfolioId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(!portfolioId ? { "Idempotency-Key": crypto.randomUUID() } : {}),
          },
          body: JSON.stringify({ ...portfolioForm, skills: commaList(portfolioForm.skills) }),
        },
      );
      const body = await responseBody(response);
      if (!response.ok || !body?.data) {
        setFeedbackIsError(true);
        setFeedback(body?.error?.message ?? "Portfolio item could not be saved. Please try again.");
        return;
      }
      const updated = body.data as PortfolioItem;
      setPortfolio((items) =>
        portfolioId
          ? items.map((item) => (item.id === portfolioId ? updated : item))
          : [updated, ...items],
      );
      cancelPortfolioEdit();
      setFeedback("Portfolio saved.");
    } catch {
      setFeedbackIsError(true);
      setFeedback("Portfolio item could not be saved. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const removePortfolio = async (id: string) => {
    if (!confirm("Remove this portfolio item?")) return;
    setBusy(true);
    setFeedback("");
    setFeedbackIsError(false);
    try {
      const response = await fetch(`/api/profile/portfolio/${id}`, { method: "DELETE" });
      const body = await responseBody(response);
      if (response.ok) {
        setPortfolio((items) => items.filter((item) => item.id !== id));
        setFeedback("Portfolio item removed.");
      } else {
        setFeedbackIsError(true);
        setFeedback(
          body?.error?.message ?? "Portfolio item could not be removed. Please try again.",
        );
      }
    } catch {
      setFeedbackIsError(true);
      setFeedback("Portfolio item could not be removed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const updateVisibility = async () => {
    const makePublic = !profile.isPublic;
    setBusy(true);
    setFeedback("");
    setFeedbackIsError(false);
    try {
      const response = await fetch("/api/profile/visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: makePublic }),
      });
      const body = await responseBody(response);
      if (!response.ok || !body?.data) {
        setFeedbackIsError(true);
        setFeedback(
          body?.error?.message ?? "Profile visibility could not be changed. Please try again.",
        );
        return;
      }
      const updated = body.data as Profile;
      setSavedProfile(updated);
      setProfile(updated);
      setFeedback(makePublic ? "Profile published." : "Profile is now private.");
      router.refresh();
    } catch {
      setFeedbackIsError(true);
      setFeedback("Profile visibility could not be changed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="talent-editor-stack">
      <section className="panel profile-main">
        <div className="profile-editor-heading">
          <div className="profile-identity compact">
            <div className="profile-avatar">{profile.displayName.slice(0, 2).toUpperCase()}</div>
            <div>
              <div>
                <h2>{profile.displayName}</h2>
                <span className={`availability availability-${profile.availability.toLowerCase()}`}>
                  {profile.availability.toLowerCase()}
                </span>
              </div>
              <p>{profile.headline || "Add a professional headline"}</p>
              <span>{profile.primaryRole || "Add your primary role"}</span>
            </div>
          </div>
          <div className="profile-editor-actions">
            <Link className="secondary-button" href={`/talent/${profile.userId}`}>
              <ExternalLink size={15} /> Preview profile
            </Link>
            <button
              className="secondary-button"
              onClick={() => (editing ? cancelProfileEdit() : setEditing(true))}
            >
              {editing ? <X size={15} /> : <Pencil size={15} />}
              {editing ? "Cancel" : "Edit profile"}
            </button>
          </div>
        </div>
        {feedback && (
          <p className={`form-feedback ${feedbackIsError ? "error" : "success"}`}>{feedback}</p>
        )}
        {editing ? (
          <form className="profile-edit-form" onSubmit={saveProfile}>
            <div className="profile-form-section-heading">
              <h3>Professional identity</h3>
              <p>How clients will understand your focus and value.</p>
            </div>
            <div className="two-fields">
              <label>
                Display name
                <input
                  value={profile.displayName}
                  onChange={(event) => set("displayName", event.target.value)}
                  required
                />
              </label>
              <label>
                Primary role
                <input
                  value={profile.primaryRole ?? ""}
                  onChange={(event) => set("primaryRole", event.target.value)}
                  required
                />
              </label>
            </div>
            <label>
              Professional headline
              <input
                value={profile.headline ?? ""}
                onChange={(event) => set("headline", event.target.value)}
                maxLength={160}
                required
              />
            </label>
            <label>
              Bio
              <textarea
                value={profile.bio ?? ""}
                onChange={(event) => set("bio", event.target.value)}
                rows={6}
                maxLength={5000}
                required
              />
            </label>
            <div className="profile-form-section-heading">
              <h3>Expertise</h3>
              <p>Help clients match your experience to their work.</p>
            </div>
            <div className="two-fields">
              <label>
                Skills
                <input
                  value={skillsText}
                  onChange={(event) => setSkillsText(event.target.value)}
                  placeholder="React, research, product design"
                />
              </label>
              <label>
                Languages
                <input
                  value={languagesText}
                  onChange={(event) => setLanguagesText(event.target.value)}
                  placeholder="English, French"
                />
              </label>
            </div>
            <fieldset className="category-checks">
              <legend>Preferred work categories</legend>
              {JOB_CATEGORIES.map((category) => (
                <label key={category}>
                  <input
                    type="checkbox"
                    checked={profile.preferredWorkCategories.includes(category)}
                    onChange={(event) =>
                      set(
                        "preferredWorkCategories",
                        event.target.checked
                          ? [...profile.preferredWorkCategories, category]
                          : profile.preferredWorkCategories.filter((item) => item !== category),
                      )
                    }
                  />
                  {category.toLowerCase()}
                </label>
              ))}
            </fieldset>
            <div className="profile-form-section-heading">
              <h3>Availability and location</h3>
              <p>Set expectations for collaboration and working hours.</p>
            </div>
            <div className="three-fields">
              <label>
                Experience level
                <select
                  value={profile.experienceLevel ?? "INTERMEDIATE"}
                  onChange={(event) => set("experienceLevel", event.target.value)}
                >
                  <option value="ENTRY">Entry</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="EXPERT">Expert</option>
                </select>
              </label>
              <label>
                Years of experience
                <input
                  type="number"
                  min={0}
                  max={80}
                  value={profile.yearsExperience ?? ""}
                  onChange={(event) =>
                    set("yearsExperience", event.target.value ? Number(event.target.value) : null)
                  }
                />
              </label>
              <label>
                Availability
                <select
                  value={profile.availability}
                  onChange={(event) =>
                    set("availability", event.target.value as Profile["availability"])
                  }
                >
                  <option value="AVAILABLE">Available</option>
                  <option value="LIMITED">Limited</option>
                  <option value="UNAVAILABLE">Unavailable</option>
                </select>
              </label>
            </div>
            <div className="two-fields">
              <label>
                Country
                <select
                  value={profile.countryCode ?? ""}
                  onChange={(event) => set("countryCode", event.target.value)}
                  required
                >
                  <option value="">Select a country</option>
                  {profile.countryCode &&
                    !countries.some(([code]) => code === profile.countryCode) && (
                      <option value={profile.countryCode}>{profile.countryCode}</option>
                    )}
                  {countries.map(([code, name]) => (
                    <option value={code} key={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Timezone
                <input
                  list="klaveroq-timezones"
                  value={profile.timezone}
                  onChange={(event) => set("timezone", event.target.value)}
                  placeholder="Africa/Lagos"
                  required
                />
                <datalist id="klaveroq-timezones">
                  {commonTimezones.map((timezone) => (
                    <option value={timezone} key={timezone} />
                  ))}
                </datalist>
              </label>
            </div>
            <div className="profile-form-section-heading">
              <h3>Online presence</h3>
              <p>Add links that help clients verify your work.</p>
            </div>
            <div className="three-fields">
              <label>
                GitHub URL
                <input
                  type="url"
                  value={profile.githubUrl ?? ""}
                  onChange={(event) => set("githubUrl", event.target.value || null)}
                />
              </label>
              <label>
                Website URL
                <input
                  type="url"
                  value={profile.websiteUrl ?? ""}
                  onChange={(event) => set("websiteUrl", event.target.value || null)}
                />
              </label>
              <label>
                LinkedIn URL
                <input
                  type="url"
                  value={profile.linkedinUrl ?? ""}
                  onChange={(event) => set("linkedinUrl", event.target.value || null)}
                />
              </label>
            </div>
            <button className="primary-button" disabled={busy}>
              <Save size={16} /> {busy ? "Saving..." : "Save profile"}
            </button>
          </form>
        ) : (
          <div className="profile-view-body">
            <section className="profile-bio">
              <h3>About</h3>
              <p>{profile.bio || "Add a bio to describe your professional work."}</p>
            </section>
            <section className="profile-skills">
              <h3>Skills</h3>
              <div>
                {profile.skills.length ? (
                  profile.skills.map((skill) => <span key={skill}>{skill}</span>)
                ) : (
                  <p>No skills added yet.</p>
                )}
              </div>
            </section>
            <div className="profile-links">
              {profile.githubUrl && (
                <a href={profile.githubUrl} target="_blank" rel="noreferrer">
                  <Github size={15} /> GitHub
                </a>
              )}
              {profile.websiteUrl && (
                <a href={profile.websiteUrl} target="_blank" rel="noreferrer">
                  <Globe2 size={15} /> Website
                </a>
              )}
              {profile.linkedinUrl && (
                <a href={profile.linkedinUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={15} /> LinkedIn
                </a>
              )}
            </div>
          </div>
        )}
      </section>

      {!profile.isPublic && (
        <section className="profile-readiness" aria-labelledby="profile-readiness-title">
          <div className="readiness-summary">
            <div>
              <p className="eyebrow">Before publishing</p>
              <h2 id="profile-readiness-title">Profile readiness</h2>
              <p>
                {readyCount} of {readiness.length} required details complete
              </p>
            </div>
            <strong>{Math.round((readyCount / readiness.length) * 100)}%</strong>
          </div>
          <div
            className="readiness-progress"
            role="progressbar"
            aria-label="Profile readiness"
            aria-valuemin={0}
            aria-valuemax={readiness.length}
            aria-valuenow={readyCount}
          >
            <span style={{ width: `${(readyCount / readiness.length) * 100}%` }} />
          </div>
          <ul>
            {readiness.map((item) => (
              <li className={item.complete ? "complete" : ""} key={item.label}>
                {item.complete ? <Check size={15} /> : <Circle size={15} />}
                <span>{item.label}</span>
                <small>{item.complete ? "Complete" : "Missing"}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel profile-visibility">
        <div>
          <span className={`visibility-icon ${profile.isPublic ? "public" : ""}`}>
            {profile.isPublic ? <Eye size={18} /> : <EyeOff size={18} />}
          </span>
          <div>
            <h2>Talent profile visibility</h2>
            <strong>{profile.isPublic ? "Public" : "Private"}</strong>
            <p>
              {profile.isPublic
                ? "Your professional profile, portfolio and Klaveroq reputation can appear in Talent Discovery."
                : "Your profile is only visible to you and participants in existing Klaveroq engagements where required."}
            </p>
          </div>
        </div>
        <button
          type="button"
          className={profile.isPublic ? "secondary-button" : "primary-button"}
          onClick={updateVisibility}
          disabled={busy || (!profile.isPublic && !profileReady)}
          aria-describedby={!profile.isPublic && !profileReady ? "publish-guidance" : undefined}
        >
          {profile.isPublic ? <EyeOff size={16} /> : <Eye size={16} />}
          {profile.isPublic ? "Make profile private" : "Publish profile"}
        </button>
        {!profile.isPublic && !profileReady && (
          <span className="sr-only" id="publish-guidance">
            Complete all required profile details before publishing.
          </span>
        )}
      </section>

      <section className="panel portfolio-manager">
        <div className="section-heading">
          <div>
            <h2>Portfolio</h2>
            <p>Show clients relevant work, your role, and the technologies used.</p>
          </div>
          <button
            className="secondary-button"
            onClick={() => {
              setPortfolioId(null);
              setPortfolioForm(emptyPortfolio);
              setShowPortfolioForm(true);
            }}
          >
            <Plus size={15} /> Add project
          </button>
        </div>
        {showPortfolioForm && (
          <form className="portfolio-form" onSubmit={savePortfolio}>
            <div className="two-fields">
              <label>
                Project title
                <input
                  value={portfolioForm.title}
                  onChange={(event) =>
                    setPortfolioForm((value) => ({ ...value, title: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Your role
                <input
                  value={portfolioForm.projectRole}
                  onChange={(event) =>
                    setPortfolioForm((value) => ({ ...value, projectRole: event.target.value }))
                  }
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                rows={4}
                value={portfolioForm.description}
                onChange={(event) =>
                  setPortfolioForm((value) => ({ ...value, description: event.target.value }))
                }
                required
              />
            </label>
            <label>
              Skills and technologies
              <input
                value={portfolioForm.skills}
                onChange={(event) =>
                  setPortfolioForm((value) => ({ ...value, skills: event.target.value }))
                }
              />
            </label>
            <div className="two-fields">
              <label>
                Project URL
                <input
                  type="url"
                  value={portfolioForm.projectUrl}
                  onChange={(event) =>
                    setPortfolioForm((value) => ({ ...value, projectUrl: event.target.value }))
                  }
                />
              </label>
              <label>
                GitHub URL
                <input
                  type="url"
                  value={portfolioForm.githubUrl}
                  onChange={(event) =>
                    setPortfolioForm((value) => ({ ...value, githubUrl: event.target.value }))
                  }
                />
              </label>
            </div>
            <div className="proposal-actions">
              <button type="button" className="secondary-button" onClick={cancelPortfolioEdit}>
                Cancel
              </button>
              <button className="primary-button" disabled={busy}>
                <Save size={15} />{" "}
                {busy ? "Saving..." : portfolioId ? "Update project" : "Add project"}
              </button>
            </div>
          </form>
        )}
        <div className="portfolio-list">
          {portfolio.length ? (
            portfolio.map((item) => (
              <article key={item.id}>
                <div>
                  <h3>{item.title}</h3>
                  <span>{item.projectRole || "Project contributor"}</span>
                </div>
                <p>{item.description}</p>
                <div className="skill-list">
                  {item.skills.map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))}
                </div>
                <footer>
                  <div>
                    {item.projectUrl && (
                      <a href={item.projectUrl} target="_blank" rel="noreferrer">
                        <ExternalLink size={14} /> Project
                      </a>
                    )}
                    {item.githubUrl && (
                      <a href={item.githubUrl} target="_blank" rel="noreferrer">
                        <Github size={14} /> Source
                      </a>
                    )}
                  </div>
                  <div>
                    <button
                      className="icon-button"
                      onClick={() => editPortfolio(item)}
                      aria-label={`Edit ${item.title}`}
                      title="Edit project"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button danger"
                      onClick={() => removePortfolio(item.id)}
                      aria-label={`Delete ${item.title}`}
                      title="Delete project"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </footer>
              </article>
            ))
          ) : (
            <div className="market-empty compact-empty portfolio-empty">
              <h3>No portfolio projects yet</h3>
              <p>Add one strong project to help clients understand the kind of work you do.</p>
              <button className="secondary-button" onClick={() => setShowPortfolioForm(true)}>
                <Plus size={15} /> Add project
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
