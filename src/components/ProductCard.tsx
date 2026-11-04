import Link from "next/link";
import type { CardProduct } from "@/server/catalog";
import { discountPercent, formatPaise } from "@/lib/money";
import { AddButton } from "./AddButton";
import { CardPeek } from "./CardPeek";
import { Rating } from "./Rating";

export function ProductCard({ p, priority = false }: { p: CardProduct; priority?: boolean }) {
  const off = discountPercent(p.pricePaise, p.compareAtPaise);
  return (
    <CardPeek price={formatPaise(p.pricePaise)} storeName={p.storeName} ratingAvg={p.ratingAvg} ratingCount={p.ratingCount}>
      <div className="pcard__media">
        {p.imageUrl ? (
          <img
            src={p.imageUrl}
            alt={p.imageAlt || p.title}
            loading={priority ? "eager" : "lazy"}
            referrerPolicy="no-referrer"
          />
        ) : null}
        {off ? <span className="pcard__tag">-{off}%</span> : null}
      </div>
      <div className="pcard__body">
        <h3 className="pcard__title">
          <Link href={`/p/${p.slug}`}>{p.title}</Link>
        </h3>
        <div className="pcard__meta">
          <Rating avg={p.ratingAvg} count={p.ratingCount} compact />
          <span className="store">{p.storeName}</span>
        </div>
        <div className="pcard__foot">
          <span className="price">
            <span className={off ? "price-sale" : undefined}>{formatPaise(p.pricePaise)}</span>
            {off && p.compareAtPaise ? <span className="price-was">{formatPaise(p.compareAtPaise)}</span> : null}
          </span>
          {p.soldOut ? (
            <span className="badge">Sold out</span>
          ) : p.quickAddVariantId ? (
            <AddButton variantId={p.quickAddVariantId} />
          ) : (
            <Link href={`/p/${p.slug}`} className="btn btn--secondary" tabIndex={-1} aria-hidden="true">
              Options
            </Link>
          )}
        </div>
      </div>
    </CardPeek>
  );
}

export function ProductGrid({ items, wide = false }: { items: CardProduct[]; wide?: boolean }) {
  return (
    <div className={`grid${wide ? " grid--wide" : ""}`}>
      {items.map((p, i) => (
        <ProductCard key={p.id} p={p} priority={i < 4} />
      ))}
    </div>
  );
}
