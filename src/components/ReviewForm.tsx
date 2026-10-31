"use client";

import { useActionState, useState } from "react";
import { submitReview, type ReviewState } from "@/app/actions/reviews";

export function ReviewForm({ orderItemId }: { orderItemId: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReview, {});
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);

  if (state.ok) return <span className="xsmall muted">Thanks for the review</span>;
  if (!open)
    return (
      <button type="button" className="linkbtn xsmall" onClick={() => setOpen(true)}>
        Write a review
      </button>
    );

  return (
    <form action={action} className="stack-sm" style={{ marginTop: 8 }}>
      <input type="hidden" name="orderItemId" value={orderItemId} />
      <input type="hidden" name="rating" value={rating} />
      <div className="row" style={{ gap: 4 }} role="group" aria-label={`Rating: ${rating || "none"} of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
            className="chip"
            aria-pressed={n <= rating}
            onClick={() => setRating(n)}
            style={{ width: 38, padding: 0, justifyContent: "center" }}
          >
            ★
          </button>
        ))}
      </div>
      <textarea className="textarea" name="body" placeholder="What was it like? (optional)" maxLength={1000} style={{ minHeight: 70 }} />
      {state.error && <p className="form-error">{state.error}</p>}
      <div className="row">
        <button className="btn btn--secondary btn--sm" disabled={pending || rating === 0}>
          {pending ? "Posting" : "Post review"}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
