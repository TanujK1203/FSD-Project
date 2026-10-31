import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { getHome } from "@/server/catalog";
import { ProductGrid } from "@/components/ProductCard";
import { SearchBox } from "@/components/SearchBox";
import { SITE } from "@/config";
import { initials } from "@/lib/text";
import styles from "./home.module.css";

export default async function Home() {
  const { latest, stores, categories } = await getHome();
  const cats = CATEGORIES.filter((c) => categories.get(c.slug));

  return (
    <div className="container stack-lg">
      <div className={styles.top}>
        <h1 className={styles.title}>Small stores, one cart.</h1>
        <div className={styles.mobileSearch}>
          <SearchBox />
        </div>
        {cats.length > 0 && (
          <nav className="chips" aria-label="Categories">
            {cats.map((c) => (
              <Link key={c.slug} href={`/search?category=${c.slug}`} className="chip">
                {c.label}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {stores.length > 0 && (
        <section aria-labelledby="stores-h">
          <div className="section-head">
            <h2 id="stores-h">Stores</h2>
          </div>
          <ul className={styles.stores}>
            {stores.map((s) => (
              <li key={s.slug}>
                <Link href={`/s/${s.slug}`} className={styles.store}>
                  <span className="avatar avatar--lg">
                    {s.logoUrl ? <img src={s.logoUrl} alt="" referrerPolicy="no-referrer" /> : initials(s.name)}
                  </span>
                  <span className={styles.storeName}>{s.name}</span>
                  <span className="xsmall muted num">{s._count.products} items</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="new-h">
        <div className="section-head">
          <h2 id="new-h">Just added</h2>
          {latest.length > 0 && <Link href="/search?sort=newest">See all</Link>}
        </div>
        {latest.length ? (
          <ProductGrid items={latest} wide />
        ) : (
          <div className="empty">
            <h2>No products yet</h2>
            <p>Stores are still setting up. Check back soon.</p>
          </div>
        )}
      </section>

      <section className={styles.sell}>
        <div>
          <h2>Sell on {SITE.name}</h2>
          <p className="muted">
            Paste your store link or connect Instagram. We bring your products over, you check them, and you are live.
          </p>
        </div>
        <Link href="/sell" className="btn btn--secondary">
          Start selling
        </Link>
      </section>
    </div>
  );
}
