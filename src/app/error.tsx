"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container">
      <div className="empty">
        <h1>Something went wrong</h1>
        <p>Try again in a moment.</p>
        <button className="btn btn--secondary" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
