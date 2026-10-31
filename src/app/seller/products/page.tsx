import type { Metadata } from "next";
import Link from "next/link";
import type { ProductStatus } from "@prisma/client";
import { requireSellerStore } from "@/server/auth";
import { db } from "@/server/db";
import { bulkProducts } from "@/app/actions/seller";
import { formatPaise } from "@/lib/money";
import { SelectAll } from "@/components/SelectAll";

export const metadata: Metadata = { title: "Products" };

const TABS: { key: ProductStatus | "ALL"; label: string }[] = [
  { key: "PUBLISHED", label: "Live" },
  { key: "DRAFT", label: "Drafts" },
  { key: "ARCHIVED", label: "Archived" },
];

export default async function SellerProducts({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { store } = await requireSellerStore("/seller/products");
  const sp = await searchParams;
  const status = (TABS.find((t) => t.key === sp.status)?.key ?? "PUBLISHED") as ProductStatus;
  const q = (sp.q ?? "").trim().toLowerCase();
  const [products, counts] = await Promise.all([
    db.product.findMany({
      where: { storeId: store.id, status, ...(q ? { searchText: { contains: q } } : {}) },
      orderBy: { updatedAt: "desc" },
      include: {
        images: { orderBy: { position: "asc" }, take: 1 },
        variants: { select: { stock: true, available: true } },
      },
      take: 300,
    }),
    db.product.groupBy({ by: ["status"], where: { storeId: store.id }, _count: { _all: true } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <div className="stack">
      <div className="row row--between">
        <nav className="row" style={{ gap: "var(--s2)" }} aria-label="Product status">
          {TABS.map((t) => (
            <Link key={t.key} href={`/seller/products?status=${t.key}`} className="chip" aria-current={status === t.key ? "true" : undefined}>
              {t.label} <span className="num" style={{ marginLeft: 6, opacity: 0.7 }}>{count(t.key)}</span>
            </Link>
          ))}
        </nav>
        <div className="row" style={{ gap: "var(--s2)" }}>
          <form action="/seller/products">
            <input type="hidden" name="status" value={status} />
            <input className="input input--sm" name="q" placeholder="Find a product" defaultValue={sp.q} aria-label="Find a product" />
          </form>
          <Link href="/seller/products/new" className="btn btn--secondary btn--sm">
            Add product
          </Link>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="empty">
          <p>{status === "DRAFT" ? "No drafts." : status === "ARCHIVED" ? "Nothing archived." : "No live products yet."}</p>
          {status !== "ARCHIVED" && (
            <Link href={status === "DRAFT" ? "/sell/import" : "/sell/review"} className="btn btn--secondary">
              {status === "DRAFT" ? "Import products" : "Publish your drafts"}
            </Link>
          )}
        </div>
      ) : (
        <>
          <form id="bulk-products" action={bulkProducts} className="row row--between">
            <SelectAll formId="bulk-products" />
            <div className="row" style={{ gap: "var(--s2)" }}>
              {status !== "PUBLISHED" && (
                <button name="op" value="publish" className="btn btn--secondary btn--sm">
                  Publish
                </button>
              )}
              {status === "PUBLISHED" && (
                <button name="op" value="unpublish" className="btn btn--secondary btn--sm">
                  Move to drafts
                </button>
              )}
              {status !== "ARCHIVED" && (
                <button name="op" value="archive" className="btn btn--ghost btn--sm">
                  Archive
                </button>
              )}
            </div>
          </form>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <span className="visually-hidden">Select</span>
                  </th>
                  <th>Product</th>
                  <th className="num">Price</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const tracked = p.variants.filter((v) => v.stock !== null);
                  const stock = tracked.reduce((s, v) => s + (v.stock ?? 0), 0);
                  const soldOut = p.variants.every((v) => !v.available || v.stock === 0);
                  return (
                    <tr key={p.id}>
                      <td>
                        <input type="checkbox" name="ids" value={p.id} form="bulk-products" aria-label={`Select ${p.title}`} />
                      </td>
                      <td>
                        <Link href={`/seller/products/${p.id}`} className="row" style={{ flexWrap: "nowrap", gap: 10 }}>
                          {p.images[0] ? (
                            <img className="thumb thumb--sm" src={p.images[0].url} alt="" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="thumb thumb--sm" />
                          )}
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: "block", fontWeight: 500 }}>{p.title}</span>
                            {p.needsReview && <span className="badge badge--accent">{p.needsReview}</span>}
                          </span>
                        </Link>
                      </td>
                      <td className="num">{formatPaise(p.pricePaise)}</td>
                      <td>{soldOut ? <span className="badge badge--accent">Sold out</span> : tracked.length ? <span className="num">{stock}</span> : <span className="muted">Not tracked</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
