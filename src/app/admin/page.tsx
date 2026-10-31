import type { Metadata } from "next";
import Link from "next/link";
import type { StoreStatus } from "@prisma/client";
import { db } from "@/server/db";
import { setStoreStatus } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Admin" };

const TABS: { key: StoreStatus; label: string }[] = [
  { key: "PENDING", label: "Waiting" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "SUSPENDED", label: "Paused" },
];

const SOURCE = { SHOPIFY: "Shopify", WOOCOMMERCE: "WooCommerce", GENERIC: "Website", INSTAGRAM: "Instagram", MANUAL: "Manual" } as const;

export default async function AdminStores({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = (TABS.find((t) => t.key === sp.status)?.key ?? "PENDING") as StoreStatus;
  const [stores, counts] = await Promise.all([
    db.store.findMany({
      where: { status },
      orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
      include: {
        owner: { select: { email: true, name: true } },
        _count: { select: { products: true } },
        products: { where: { status: "PUBLISHED" }, select: { id: true } },
      },
      take: 200,
    }),
    db.store.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <div className="stack">
      <nav className="row" style={{ gap: "var(--s2)" }} aria-label="Store status">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin?status=${t.key}`} className="chip" aria-current={status === t.key ? "true" : undefined}>
            {t.label} <span className="num" style={{ marginLeft: 6, opacity: 0.7 }}>{count(t.key)}</span>
          </Link>
        ))}
      </nav>
      {stores.length === 0 ? (
        <div className="empty">
          <p>{status === "PENDING" ? "No stores waiting for approval." : "None."}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Store</th>
                <th>Owner</th>
                <th>Source</th>
                <th className="num">Products</th>
                <th>Joined</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/admin/stores/${s.id}`} className="strong">
                      {s.name}
                    </Link>
                    {s.instagramHandle && <div className="xsmall muted">@{s.instagramHandle}</div>}
                  </td>
                  <td className="small">
                    {s.owner.name}
                    <div className="xsmall muted">{s.owner.email}</div>
                  </td>
                  <td className="small">
                    {SOURCE[s.sourceType]}
                    {s.sourceUrl && s.sourceType !== "INSTAGRAM" && (
                      <div className="xsmall">
                        <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer">
                          {s.sourceUrl.replace(/^https?:\/\//, "").slice(0, 32)}
                        </a>
                      </div>
                    )}
                  </td>
                  <td className="num">
                    {s.products.length}/{s._count.products}
                  </td>
                  <td className="num small">{s.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                  <td>
                    <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                      {status !== "APPROVED" && (
                        <form action={setStoreStatus}>
                          <input type="hidden" name="id" value={s.id} />
                          <button name="status" value="APPROVED" className="btn btn--secondary btn--sm">
                            {status === "SUSPENDED" ? "Reinstate" : "Approve"}
                          </button>
                        </form>
                      )}
                      {status === "PENDING" && (
                        <form action={setStoreStatus} className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                          <input type="hidden" name="id" value={s.id} />
                          <input className="input input--sm" name="reason" placeholder="Reason" aria-label="Reason for rejecting" style={{ width: 130 }} />
                          <button name="status" value="REJECTED" className="btn btn--danger-text btn--sm">
                            Reject
                          </button>
                        </form>
                      )}
                      {status === "APPROVED" && (
                        <form action={setStoreStatus}>
                          <input type="hidden" name="id" value={s.id} />
                          <button name="status" value="SUSPENDED" className="btn btn--danger-text btn--sm">
                            Pause
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="xsmall muted">Products column: live / total including drafts.</p>
    </div>
  );
}
