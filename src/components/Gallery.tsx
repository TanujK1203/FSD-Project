"use client";

import { useState } from "react";

export function Gallery({ images, title }: { images: { url: string; alt: string | null }[]; title: string }) {
  const [active, setActive] = useState(0);
  if (!images.length) return <div className="gallery__main" aria-hidden="true" />;
  const current = images[Math.min(active, images.length - 1)]!;
  return (
    <div className="gallery">
      <div className="gallery__main">
        <img key={current.url} src={current.url} alt={current.alt || title} referrerPolicy="no-referrer" />
      </div>
      {images.length > 1 && (
        <div className="gallery__thumbs" role="list">
          {images.map((img, i) => (
            <button
              key={img.url + i}
              type="button"
              role="listitem"
              aria-label={`Photo ${i + 1} of ${images.length}`}
              aria-current={i === active}
              onClick={() => setActive(i)}
            >
              <img src={img.url} alt="" loading="lazy" referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
