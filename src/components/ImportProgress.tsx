"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Job = {
  status: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
  adapter: string | null;
  found: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  error: string | null;
  logs: { level: string; msg: string }[];
};

const SOURCE: Record<string, string> = {
  shopify: "Shopify store",
  woocommerce: "WooCommerce store",
  generic: "Website",
  instagram: "Instagram",
};

export function ImportProgress({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`/api/import/${jobId}`, { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as Job;
          if (!stop) setJob(data);
          if (data.status === "DONE" || data.status === "FAILED") return;
        }
      } catch {}
      if (!stop) timer = setTimeout(tick, 1500);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  if (!job) return <div className="panel small muted">Starting import</div>;

  const saved = job.created + job.updated;
  const working = job.status === "QUEUED" || job.status === "RUNNING";

  return (
    <div className="panel stack" aria-live="polite">
      <div className="row row--between">
        <h2 style={{ fontSize: "var(--fs-md)" }}>
          {working ? "Importing your products" : job.status === "DONE" ? "Import finished" : "Import stopped"}
        </h2>
        {job.adapter && <span className="badge">{SOURCE[job.adapter] ?? job.adapter}</span>}
      </div>

      <div className="import-meter" aria-hidden={!working}>
        <div
          className="import-meter__bar"
          data-working={working}
          style={{ width: job.found ? `${Math.min(100, Math.round((saved / Math.max(1, Math.min(job.found, 500))) * 100))}%` : "8%" }}
        />
      </div>

      <dl className="import-counts">
        <div>
          <dt>New drafts</dt>
          <dd className="num">{job.created}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd className="num">{job.updated}</dd>
        </div>
        <div>
          <dt>Skipped</dt>
          <dd className="num">{job.skipped + job.failed}</dd>
        </div>
      </dl>

      {job.logs.length > 0 && (
        <ul className="import-log">
          {job.logs.map((l, i) => (
            <li key={i} data-level={l.level}>
              {l.msg}
            </li>
          ))}
        </ul>
      )}

      {job.status === "DONE" && (
        <Link href="/sell/review" className="btn btn--primary">
          Review {job.created > 0 ? `${job.created} products` : "products"}
        </Link>
      )}
      {job.status === "FAILED" && (
        <p className="small">
          <span className="form-error">{job.error}</span>
          {saved > 0 && (
            <>
              {" "}
              <Link href="/sell/review" className="strong">
                Review the {saved} that worked
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
