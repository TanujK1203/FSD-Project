import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSellerStore } from "@/server/auth";
import { db } from "@/server/db";
import { ProductEditor } from "@/components/ProductEditor";
import { bulkProducts } from "@/app/actions/seller";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { store } = await requireSellerStore("/seller/products");
  const { id } = await params;
  const { saved } = await searchParams;
  const p = await db.product.findFirst({
    where: { id, storeId: store.id },
    include: { images: { orderBy: { position: "asc" } }, variants: { where: { available: true }, orderBy: { position: "asc" } } },
  });
  if (!p) notFound();

  const named = p.variants.filter((v) => v.name !== "Default");
  const optionName = named.length ? Object.keys(JSON.parse(named[0]!.optionsJson) as Record<string, string>)[0] ?? "Size" : "Size";
  const single = p.variants.length === 1 && p.variants[0]!.name === "Default" ? p.variants[0] : null;

  return (
    <div className="stack">
      <Link href="/seller/products" className="small muted">
        Back to products
      </Link>
      <div className="row row--between">
        <div className="row">
          <h2>Edit product</h2>
          <span className={`badge${p.status === "PUBLISHED" ? " badge--ink" : ""}`}>
            {p.status === "PUBLISHED" ? "Live" : p.status === "DRAFT" ? "Draft" : "Archived"}
          </span>
        </div>
        <form action={bulkProducts} className="row" style={{ gap: "var(--s2)" }}>
          <input type="hidden" name="ids" value={p.id} />
          {p.status !== "PUBLISHED" ? (
            <button name="op" value="publish" className="btn btn--secondary btn--sm">Publish</button>
          ) : (
            <>
              <a href={`/p/${p.slug}`} className="btn btn--ghost btn--sm">View</a>
              <button name="op" value="unpublish" className="btn btn--secondary btn--sm">Move to drafts</button>
            </>
          )}
        </form>
      </div>
      {saved && <div className="notice" role="status">Product added.</div>}
      <ProductEditor
        product={{
          id: p.id,
          title: p.title,
          description: p.description,
          category: p.category,
          price: (p.pricePaise / 100).toString(),
          compareAt: p.compareAtPaise ? (p.compareAtPaise / 100).toString() : "",
          optionName,
          options: named.map((v) => (v.stock !== null ? `${v.name}: ${v.stock}` : v.name)).join("\n"),
          stock: single?.stock !== null && single?.stock !== undefined ? String(single.stock) : "",
          images: p.images.map((i) => ({ id: i.id, url: i.url })),
          sourceUrl: p.sourceUrl,
        }}
      />
    </div>
  );
}
