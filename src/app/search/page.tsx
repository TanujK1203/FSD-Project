import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { SORTS, searchProducts, type SearchParams } from "@/server/catalog";
import { db } from "@/server/db";
import { ProductGrid } from "@/components/ProductCard";
import { SearchBox } from "@/components/SearchBox";
import { AutoSubmitSelect, FilterSheet } from "@/components/FilterSheet";
import styles from "./search.module.css";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const sp = await searchParams;
  return { title: sp.q ? `“${sp.q}”` : sp.category ? categoryLabel(sp.category) : "Search" };
}

function hrefWith(sp: SearchParams, patch: Partial<SearchParams>) {
  const next = { ...sp, ...patch };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v) qs.set(k, String(v));
  const s = qs.toString();
  return `/search${s ? `?${s}` : ""}`;
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const result = await searchProducts(sp);
  const store = sp.store ? await db.store.findUnique({ where: { slug: sp.store }, select: { name: true } }) : null;
  const activeCount = [sp.category, sp.min, sp.max, sp.rating, sp.store].filter(Boolean).length;
  const heading = sp.q ? `Results for “${sp.q}”` : sp.category ? categoryLabel(sp.category) : "All products";
  const pages = Math.ceil(result.total / result.pageSize);

  const filters = (
    <form action="/search" className={styles.filters}>
      {sp.q && <input type="hidden" name="q" value={sp.q} />}
      {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
      {sp.store && <input type="hidden" name="store" value={sp.store} />}
      <fieldset>
        <legend className="label">Category</legend>
        <div className={styles.radios}>
          <label className="check">
            <input type="radio" name="category" value="" defaultChecked={!sp.category} /> All
          </label>
          {CATEGORIES.map((c) => (
            <label className="check" key={c.slug}>
              <input type="radio" name="category" value={c.slug} defaultChecked={sp.category === c.slug} /> {c.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Price (₹)</legend>
        <div className={styles.price}>
          <input className="input input--sm" name="min" inputMode="numeric" placeholder="Min" defaultValue={sp.min} aria-label="Minimum price" />
          <span className="muted">to</span>
          <input className="input input--sm" name="max" inputMode="numeric" placeholder="Max" defaultValue={sp.max} aria-label="Maximum price" />
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Rating</legend>
        <div className={styles.radios}>
          <label className="check">
            <input type="radio" name="rating" value="" defaultChecked={!sp.rating} /> Any
          </label>
          <label className="check">
            <input type="radio" name="rating" value="4" defaultChecked={sp.rating === "4"} /> 4 and up
          </label>
          <label className="check">
            <input type="radio" name="rating" value="3" defaultChecked={sp.rating === "3"} /> 3 and up
          </label>
        </div>
      </fieldset>
      <div className="row">
        <button className="btn btn--secondary btn--sm">Apply filters</button>
        {activeCount > 0 && (
          <Link href={hrefWith({ q: sp.q, sort: sp.sort }, {})} className="small muted">
            Clear all
          </Link>
        )}
      </div>
    </form>
  );

  return (
    <div className="container">
      <div className={styles.mobileSearch}>
        <SearchBox defaultValue={sp.q} />
      </div>
      <div className={styles.layout}>
        <aside className={styles.side} aria-label="Filters">
          <FilterSheet activeCount={activeCount}>{filters}</FilterSheet>
        </aside>
        <div className="stack">
          <div className={styles.head}>
            <div>
              <h1 className={styles.h1}>{heading}</h1>
              <p className="small muted num">
                {result.total} {result.total === 1 ? "item" : "items"}
                {store ? ` from ${store.name}` : ""}
              </p>
            </div>
            <form action="/search" className={styles.sort}>
              {Object.entries(sp)
                .filter(([k, v]) => k !== "sort" && k !== "page" && v)
                .map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={String(v)} />
                ))}
              <label className="visually-hidden" htmlFor="sort">
                Sort by
              </label>
              <AutoSubmitSelect id="sort" name="sort" className="select input--sm" defaultValue={result.sort}>
                {SORTS.filter((s) => s.value !== "relevance" || sp.q).map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </AutoSubmitSelect>
              <noscript>
                <button className="btn btn--secondary btn--sm">Sort</button>
              </noscript>
            </form>
          </div>
          {store && (
            <div className="row">
              <Link href={hrefWith(sp, { store: undefined, page: undefined })} className="chip" aria-pressed="true">
                {store.name} ✕
              </Link>
            </div>
          )}
          {result.items.length ? (
            <ProductGrid items={result.items} />
          ) : (
            <div className="empty">
              <h2>Nothing matches yet</h2>
              <p>Try a shorter search or remove a filter.</p>
              {activeCount > 0 && (
                <Link className="btn btn--secondary" href={hrefWith({ q: sp.q }, {})}>
                  Clear filters
                </Link>
              )}
            </div>
          )}
          {pages > 1 && (
            <nav className="row row--between" aria-label="Pages">
              {result.page > 1 ? (
                <Link className="btn btn--secondary btn--sm" href={hrefWith(sp, { page: String(result.page - 1) })}>
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="small muted num">
                Page {result.page} of {pages}
              </span>
              {result.page < pages ? (
                <Link className="btn btn--secondary btn--sm" href={hrefWith(sp, { page: String(result.page + 1) })}>
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
