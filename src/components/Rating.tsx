import { StarIcon } from "./icons";

export function Rating({ avg, count, compact = false }: { avg: number; count: number; compact?: boolean }) {
  if (!count) return <span className="rating rating--new">New</span>;
  return (
    <span className="rating" aria-label={`Rated ${avg.toFixed(1)} out of 5 from ${count} review${count === 1 ? "" : "s"}`}>
      <StarIcon />
      {avg.toFixed(1)}
      {!compact && <span className="muted" style={{ fontWeight: 400 }}>({count})</span>}
    </span>
  );
}
