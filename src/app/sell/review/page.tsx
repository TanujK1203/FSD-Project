import type { Metadata } from "next";
import Link from "next/link";
import { requireSellerStore } from "@/server/auth";
import { db } from "@/server/db";
import { CATEGORIES } from "@/lib/categories";
import { bulkProducts, saveDraft } from "@/app/actions/seller";
import { formatPaise } from "@/lib/money";
import { SelectAll } from "@/components/SelectAll";
import styles from "./review.module.css";

export const metadata: Metadata = { title: "Review drafts" };

export default async function ReviewPage() {
  const { store } = await requireSellerStore("/sell/review");
  const drafts = await db.product.findMany({
    where: { storeId: store.id, status: "DRAFT" },
    orderBy: [{ needsReview: "desc" }, { createdAt: "asc" }],
    include: { images: { orderBy: { position: "asc" }, take: 1 }, _count: { select: { variants: true } } },
    take: 300,
  });
  const total = drafts.length < 300 ? drafts.length : await db.product.count({ where: { storeId: store.id, status: "DRAFT" } });
  const flagged = drafts.filter((d) => d.needsReview).length;

  return (
    <div className="container stack-lg" style={{ maxWidth: 960 }}>
      <div className="stack-sm">
        <p className="small muted">Step 3 of 3</p>
        <h1>Check and publish</h1>
        <p className="muted">
          {drafts.length
            ? `${total} drafts${flagged ? `, ${flagged} need a look` : ""}. Edit anything that came through wrong, then publish.`
            : "No drafts waiting."}
        </p>
      </div>

      {total > drafts.length && (
        <div className="notice">
          Showing the first {drafts.length}. Publish or delete these and the other {total - drafts.length} appear here.
        </div>
      )}

      {store.status !== "APPROVED" && (
        <div className="notice">
          <strong>Your store is waiting for approval.</strong> You can publish now. Buyers see your products once we
          approve the store, usually within a day.
        </div>
      )}

      {drafts.length === 0 ? (
        <div className="empty">
          <Link href="/sell/import" className="btn btn--secondary">
            Import products
          </Link>
          <Link href="/seller/products" className="small">
            See all your products
          </Link>
        </div>
      ) : (
        <>
          <form id="bulk" action={bulkProducts} className={`row row--between ${styles.bar}`}>
            <SelectAll formId="bulk" />
            <div className="row" style={{ gap: "var(--s2)" }}>
              <button name="op" value="delete" className="btn btn--danger-text btn--sm">
                Delete selected
              </button>
              <button name="op" value="publish" className="btn btn--primary btn--sm">
                Publish selected
              </button>
            </div>
          </form>

          <ul className={`list ${styles.list}`}>
            {drafts.map((d) => (
              <li key={d.id} className={styles.row}>
                <input
                  type="checkbox"
                  name="ids"
                  value={d.id}
                  form="bulk"
                  aria-label={`Select ${d.title}`}
                  defaultChecked={!d.needsReview}
                  className={styles.check}
                />
                {d.images[0] ? (
                  <img className="thumb" src={d.images[0].url} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <span className="thumb" />
                )}
                <form action={saveDraft} className={styles.fields}>
                  <input type="hidden" name="id" value={d.id} />
                  <label className={`field ${styles.title}`}>
                    <span className="visually-hidden">Name</span>
                    <input className="input input--sm" name="title" defaultValue={d.title} />
                  </label>
                  <label className="field">
                    <span className="visually-hidden">Price in rupees</span>
                    <input
                      className="input input--sm num"
                      name="price"
                      inputMode="decimal"
                      defaultValue={d.pricePaise ? (d.pricePaise / 100).toString() : ""}
                      placeholder="Price ₹"
                    />
                  </label>
                  <label className="field">
                    <span className="visually-hidden">Category</span>
                    <select className="select input--sm" name="category" defaultValue={d.category}>
                      {CATEGORIES.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="btn btn--secondary btn--sm">Save</button>
                  <div className={styles.meta}>
                    {d.needsReview && <span className="badge badge--accent">{d.needsReview}</span>}
                    {d._count.variants > 1 && <span className="xsmall muted">{d._count.variants} options</span>}
                    {d.compareAtPaise && <span className="xsmall muted">Was {formatPaise(d.compareAtPaise)}</span>}
                    <Link href={`/seller/products/${d.id}`} className="xsmall">
                      Edit details
                    </Link>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
