"use client";

import { useEffect, useState } from "react";
import { FilterIcon } from "./icons";

/** On small screens the filters live in a bottom sheet; on wide screens they render inline. */
export function FilterSheet({ children, activeCount }: { children: React.ReactNode; activeCount: number }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button type="button" className="btn btn--secondary btn--sm filter-toggle" onClick={() => setOpen(true)}>
        <FilterIcon size={16} />
        Filters{activeCount ? ` (${activeCount})` : ""}
      </button>
      <div className="filters-inline">{children}</div>
      {open && (
        <>
          <div className="sheet-backdrop" onClick={() => setOpen(false)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Filters">
            <div className="row row--between" style={{ marginBottom: "var(--s4)" }}>
              <h2>Filters</h2>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            {children}
          </div>
        </>
      )}
    </>
  );
}

export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
