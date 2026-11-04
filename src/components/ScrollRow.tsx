"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronIcon } from "./icons";

/** Wraps one horizontally scrolling element and adds arrows for mouse users, who cannot swipe it. */
export function ScrollRow({ children, label }: { children: React.ReactNode; label: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ prev: false, next: false });

  useEffect(() => {
    const row = wrap.current?.firstElementChild as HTMLElement | null;
    if (!row) return;
    const update = () =>
      setEdges({
        prev: row.scrollLeft > 4,
        next: row.scrollLeft + row.clientWidth < row.scrollWidth - 4,
      });
    const observer = new ResizeObserver(update);
    observer.observe(row);
    row.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      row.removeEventListener("scroll", update);
    };
  }, []);

  const move = (direction: 1 | -1) => {
    const row = wrap.current?.firstElementChild as HTMLElement | null;
    row?.scrollBy({ left: direction * row.clientWidth * 0.7 });
  };

  return (
    <div className="scrollrow" ref={wrap}>
      {children}
      <button
        type="button"
        className="scrollrow__arrow scrollrow__arrow--prev"
        aria-label={`Scroll ${label} back`}
        hidden={!edges.prev}
        onClick={() => move(-1)}
      >
        <ChevronIcon />
      </button>
      <button
        type="button"
        className="scrollrow__arrow scrollrow__arrow--next"
        aria-label={`Scroll ${label} forward`}
        hidden={!edges.next}
        onClick={() => move(1)}
      >
        <ChevronIcon />
      </button>
    </div>
  );
}
