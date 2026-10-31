import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { formatPaise } from "@/lib/money";
import { setStoreStatus } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Store review" };

export default async function AdminStore({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await db.store.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true, email: true, createdAt: true } },
      products: {
        where: { status: { not: "ARCHIVED" } },
        orderBy: { createdAt: "desc" },
        take: 60,
        include: { images: { orderBy: { position: "asc" }, take: 1 } },
      },
      importJobs: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });
  if (!store) notFound();

  return (
    <div className="stack-lg">
      <Link href="/admin" className="small muted">
        Back to stores
      </Link>
      <div className="row row--between">
        <div>
          <h2>{store.name}</h2>
          <p className="small muted">
            {store.owner.name}, {store.owner.email}
            {store.city ? `, ${store.city}` : ""}
          </p>
        </div>
        <div className="row" style={{ gap: "var(--s2)" }}>
          <span className="badge">{store.status}</span>
          {store.status !== "APPROVED" && (
            <form action={setStoreStatus}>
              <input type="hidden" name="id" value={store.id} />
              <button name="status" value="APPROVED" className="btn btn--primary btn--sm">
                Approve store
              </button>
            </form>
          )}
        </div>
      </div>
      {store.bio && <p className="small">{store.bio}</p>}
      <div className="row small">
        {store.sourceUrl && store.sourceType !== "INSTAGRAM" && (
          <a href={store.sourceUrl} target="_blank" rel="noopener noreferrer">
            Their website
          </a>
        )}
        {store.instagramHandle && (
          <a href={`https://instagram.com/${store.instagramHandle}`} target="_blank" rel="noopener noreferrer">
            @{store.instagramHandle}
          </a>
        )}
      </div>
      <section className="stack">
        <h3>Products ({store.products.length})</h3>
        <div className="grid">
          {store.products.map((p) => (
            <div key={p.id} className="pcard">
              <div className="pcard__media">{p.images[0] && <img src={p.images[0].url} alt="" referrerPolicy="no-referrer" />}</div>
              <div className="pcard__body">
                <span className="pcard__title">{p.title}</span>
                <div className="row row--between">
                  <span className="price small">{formatPaise(p.pricePaise)}</span>
                  <span className="badge">{p.status === "PUBLISHED" ? "Published" : "Draft"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
