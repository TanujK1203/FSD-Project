import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStorePage } from "@/server/catalog";
import { categoryLabel } from "@/lib/categories";
import { initials } from "@/lib/text";
import { ProductGrid } from "@/components/ProductCard";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ category?: string; sort?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getStorePage((await params).slug, {});
  return { title: data?.store.name ?? "Store" };
}

export default async function StorePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const data = await getStorePage(slug, sp);
  if (!data) notFound();
  const { store, products, categories } = data;
  const total = categories.reduce((s, c) => s + c._count._all, 0);

  return (
    <div className="container stack-lg">
      <header className="row" style={{ gap: "var(--s4)", alignItems: "center" }}>
        <span className="avatar avatar--lg">
          {store.logoUrl ? <img src={store.logoUrl} alt="" referrerPolicy="no-referrer" /> : initials(store.name)}
        </span>
        <div className="stack-sm" style={{ gap: 4 }}>
          <h1>{store.name}</h1>
          <p className="small muted num">
            {total} {total === 1 ? "item" : "items"}
            {store.city ? ` in ${store.city}` : ""}
            {store.instagramHandle ? (
              <>
                {"  "}
                <a href={`https://instagram.com/${store.instagramHandle}`} rel="noopener noreferrer" target="_blank" style={{ marginLeft: 8 }}>
                  @{store.instagramHandle}
                </a>
              </>
            ) : null}
          </p>
        </div>
      </header>
      {store.bio && <p className="muted" style={{ maxWidth: "65ch" }}>{store.bio}</p>}

      {categories.length > 1 && (
        <nav className="chips" aria-label="Store categories">
          <Link href={`/s/${store.slug}`} className="chip" aria-current={!sp.category ? "true" : undefined}>
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.category}
              href={`/s/${store.slug}?category=${c.category}`}
              className="chip"
              aria-current={sp.category === c.category ? "true" : undefined}
            >
              {categoryLabel(c.category)}
            </Link>
          ))}
        </nav>
      )}

      {products.length ? (
        <ProductGrid items={products} wide />
      ) : (
        <div className="empty">
          <h2>No products here yet</h2>
        </div>
      )}
    </div>
  );
}
