"use client";

import { Send, Star } from "lucide-react";
import { useState } from "react";

export function EngagementReview({
  jobId,
  existing,
}: {
  jobId: string;
  existing?: { rating: number; comment: string | null };
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [saved, setSaved] = useState(Boolean(existing));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch(`/api/jobs/${jobId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
    });
    const body = await response.json();
    if (response.ok) setSaved(true);
    else setError(body.error?.message ?? "Review could not be submitted.");
    setBusy(false);
  };

  return (
    <section className="panel engagement-review">
      <div className="section-heading">
        <div>
          <h2>Verified work review</h2>
          <p>This review is tied to this completed Klaveroq engagement.</p>
        </div>
      </div>
      <form onSubmit={submit}>
        <fieldset disabled={saved || busy}>
          <legend>Rating</legend>
          <div className="rating-control">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                type="button"
                className={value <= rating ? "active" : ""}
                onClick={() => setRating(value)}
                aria-label={`${value} star rating`}
                title={`${value} ${value === 1 ? "star" : "stars"}`}
                key={value}
              >
                <Star size={19} fill={value <= rating ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
        </fieldset>
        <label>
          Review
          <textarea
            rows={4}
            maxLength={2000}
            value={comment}
            disabled={saved || busy}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Describe communication, delivery quality, and how the agreed milestones were handled."
          />
        </label>
        {error && <p className="form-feedback error">{error}</p>}
        {saved ? (
          <p className="form-feedback success">Your verified review is recorded.</p>
        ) : (
          <button className="primary-button" disabled={busy || rating < 1}>
            <Send size={15} /> {busy ? "Submitting..." : "Submit verified review"}
          </button>
        )}
      </form>
    </section>
  );
}
