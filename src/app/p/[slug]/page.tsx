import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { alsoSoldBy, getProduct, moreFromStore } from "@/server/catalog";
import { categoryLabel } from "@/lib/categories";
import { formatPaise } from "@/lib/money";
import { initials } from "@/lib/text";
import { BuyBox } from "@/components/BuyBox";
import { Gallery } from "@/components/Gallery";
import { ProductGrid } from "@/components/ProductCard";
import { Rating } from "@/components/Rating";
import styles from "./product.module.css";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  return p ? { title: p.title, description: p.description.slice(0, 160) } : { title: "Not found" };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();

  const [others, more] = await Promise.all([
    alsoSoldBy({ id: product.id, title: product.title, category: product.category, storeId: product.store.id }),
    moreFromStore(product.store.id, product.id),
  ]);

  const variants = product.variants.map((v) => ({
    id: v.id,
    name: v.name,
    options: JSON.parse(v.optionsJson) as Record<string, string>,
    pricePaise: v.pricePaise,
    available: v.available,
    stock: v.stock,
  }));

  return (
    <div className="container stack-lg">
      <nav className="small muted" aria-label="Breadcrumb">
        <Link href={`/search?category=${product.category}`}>{categoryLabel(product.category)}</Link>
      </nav>

      <div className={styles.layout}>
        <Gallery images={product.images} title={product.title} />
        <div className={styles.info}>
          <div className="stack-sm">
            <Link href={`/s/${product.store.slug}`} className={styles.storeLink}>
              {product.store.name}
            </Link>
            <h1 className={styles.title}>{product.title}</h1>
            <Rating avg={product.ratingAvg} count={product.ratingCount} />
          </div>
          <BuyBox variants={variants} compareAtPaise={product.compareAtPaise} />
          <p className="small muted">
            Sold and shipped by {product.store.name}. Shipping is worked out per store at checkout.
          </p>
          {product.description && (
            <section className="stack-sm">
              <h2 className={styles.h2}>Details</h2>
              <div className={styles.desc}>{product.description}</div>
            </section>
          )}
        </div>
      </div>

      {others.length > 0 && (
        <section aria-labelledby="compare-h" className="stack">
          <div className="section-head">
            <h2 id="compare-h">Similar from other stores</h2>
          </div>
          <ul className={`list ${styles.compare}`}>
            {others.map((o) => (
              <li key={o.id}>
                <Link href={`/p/${o.slug}`} className={styles.compareRow}>
                  {o.imageUrl ? <img className="thumb thumb--sm" src={o.imageUrl} alt="" referrerPolicy="no-referrer" /> : <span className="thumb thumb--sm" />}
                  <span className={styles.compareText}>
                    <span className="strong">{o.storeName}</span>
                    <span className="small muted">{o.title}</span>
                  </span>
                  <span className="price num">{formatPaise(o.pricePaise)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {product.reviews.length > 0 && (
        <section aria-labelledby="reviews-h" className="stack">
          <div className="section-head">
            <h2 id="reviews-h">Reviews</h2>
          </div>
          <ul className="list">
            {product.reviews.map((r) => (
              <li key={r.id} className={styles.review}>
                <div className="row">
                  <Rating avg={r.rating} count={1} compact />
                  <span className="small strong">{r.user.name.split(" ")[0]}</span>
                  <span className="xsmall muted">{r.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                {r.body && <p className="small">{r.body}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {more.length > 0 && (
        <section aria-labelledby="more-h">
          <div className="section-head">
            <h2 id="more-h">More from {product.store.name}</h2>
            <Link href={`/s/${product.store.slug}`}>Visit store</Link>
          </div>
          <ProductGrid items={more.slice(0, 4)} />
        </section>
      )}

      <section className={styles.seller}>
        <span className={`avatar${product.store.logoUrl ? " avatar--logo" : ""}`}>
          {product.store.logoUrl ? <img src={product.store.logoUrl} alt="" referrerPolicy="no-referrer" /> : initials(product.store.name)}
        </span>
        <div>
          <Link href={`/s/${product.store.slug}`} className="strong">
            {product.store.name}
          </Link>
          {product.store.city && <p className="small muted">{product.store.city}</p>}
        </div>
      </section>
    </div>
  );
}
