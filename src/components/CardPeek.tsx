"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { StarIcon } from "./icons";

const PEEK_HALF_WIDTH = 120;

/** Product card that opens a small floating summary on click. A click anywhere else closes it. */
export function CardPeek({
  price,
  storeName,
  ratingAvg,
  ratingCount,
  children,
}: {
  price: string;
  storeName: string;
  ratingAvg: number;
  ratingCount: number;
  children: React.ReactNode;
}) {
  const card = useRef<HTMLElement>(null);
  const peek = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const open = position !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setPosition(null);
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!peek.current?.contains(target) && !card.current?.contains(target)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const onClick = (e: React.MouseEvent<HTMLElement>) => {
    // the title link, Add and Options keep doing their own job
    if ((e.target as HTMLElement).closest("a, button, form")) return;
    if (open) return setPosition(null);
    const rect = e.currentTarget.getBoundingClientRect();
    const pageWidth = document.documentElement.clientWidth;
    const center = rect.left + rect.width / 2;
    setPosition({
      top: rect.top + window.scrollY + rect.height / 2,
      left: Math.min(Math.max(center, PEEK_HALF_WIDTH + 8), pageWidth - PEEK_HALF_WIDTH - 8) + window.scrollX,
    });
  };

  return (
    <>
      <article ref={card} className="pcard" data-open={open} onClick={onClick}>
        {children}
      </article>
      {position &&
        createPortal(
          <div ref={peek} className="peek" role="status" style={position}>
            <p className="peek__price price">{price}</p>
            <p className="peek__row">
              <span className="muted">Seller</span>
              <span className="strong">{storeName}</span>
            </p>
            <p className="peek__row">
              <span className="muted">Reviews</span>
              {ratingCount > 0 ? (
                <span className="rating">
                  <StarIcon />
                  {ratingAvg.toFixed(1)} out of 5
                </span>
              ) : (
                <span className="strong">No reviews yet</span>
              )}
            </p>
          </div>,
          document.body,
        )}
    </>
  );
}
