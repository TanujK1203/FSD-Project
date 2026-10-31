import type { Metadata } from "next";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Imports" };

export default async function AdminImports() {
  const jobs = await db.importJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { store: { select: { name: true } } },
  });
  return (
    <div className="stack">
      <p className="small muted">Every product import and daily resync. Open a row to see its log.</p>
      <ul className="list panel" style={{ padding: 0 }}>
        {jobs.map((j) => {
          const logs = JSON.parse(j.logJson) as { level: string; msg: string }[];
          return (
            <li key={j.id}>
              <details style={{ padding: "var(--s3) var(--s4)" }}>
                <summary className="row row--between" style={{ cursor: "pointer", listStyle: "none" }}>
                  <span className="small">
                    <span className="strong">{j.store.name}</span>{" "}
                    <span className="muted">
                      {j.sourceUrl.startsWith("instagram:") ? "Instagram" : j.sourceUrl.replace(/^https?:\/\//, "").slice(0, 40)}
                      {j.adapter ? ` (${j.adapter})` : ""}
                      {j.kind === "resync" ? ", resync" : ""}
                    </span>
                  </span>
                  <span className="row small" style={{ gap: "var(--s3)" }}>
                    <span className="num muted">
                      {j.created} new, {j.updated} upd, {j.failed} failed
                    </span>
                    <span className={`badge${j.status === "FAILED" ? " badge--accent" : j.status === "DONE" ? " badge--ink" : ""}`}>{j.status}</span>
                    <span className="xsmall muted num">{j.createdAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                  </span>
                </summary>
                <ul className="import-log" style={{ marginTop: "var(--s3)" }}>
                  {j.error && <li data-level="error">{j.error}</li>}
                  {logs.map((l, i) => (
                    <li key={i} data-level={l.level}>
                      {l.msg}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
