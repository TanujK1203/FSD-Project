import type { Metadata } from "next";
import Link from "next/link";
import { requireSellerStore } from "@/server/auth";
import { db } from "@/server/db";
import { resyncStore } from "@/app/actions/seller";
import { formatPaise } from "@/lib/money";
import { ChevronIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Your store" };

const SOURCE: Record<string, string> = {
  SHOPIFY: "Shopify",
  WOOCOMMERCE: "WooCommerce",
  GENERIC: "your website",
  INSTAGRAM: "Instagram",
  MANUAL: "added by hand",
};

export default async function SellerHome() {
  const { store } = await requireSellerStore();
  const [toShip, drafts, live, ready, jobs] = await Promise.all([
    db.sellerOrder.count({ where: { storeId: store.id, status: { in: ["PLACED", "PACKED"] }, order: { status: "PAID" } } }),
    db.product.count({ where: { storeId: store.id, status: "DRAFT" } }),
    db.product.count({ where: { storeId: store.id, status: "PUBLISHED" } }),
    db.payout.aggregate({ where: { storeId: store.id, status: "READY" }, _sum: { netPaise: true } }),
    db.importJob.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const todo = [
    toShip > 0 && { href: "/seller/orders", label: `${toShip} ${toShip === 1 ? "order" : "orders"} to pack and ship` },
    drafts > 0 && { href: "/sell/review", label: `${drafts} ${drafts === 1 ? "draft" : "drafts"} to check and publish` },
    (ready._sum.netPaise ?? 0) > 0 && { href: "/seller/payouts", label: `${formatPaise(ready._sum.netPaise!)} ready to be paid out` },
    !store.payoutUpi && { href: "/seller/settings", label: "Add your UPI ID for payouts" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="stack-lg" style={{ maxWidth: 760 }}>
      {store.status === "PENDING" && (
        <div className="notice">
          <strong>Waiting for approval.</strong> We review new stores within a day. Publish your products now and they go
          live the moment you are approved.
        </div>
      )}
      {store.status === "REJECTED" && (
        <div className="notice notice--accent">
          <strong>Your store was not approved.</strong> {store.rejectionReason ?? "Reply to our email to sort it out."}
        </div>
      )}
      {store.status === "SUSPENDED" && (
        <div className="notice notice--accent">
          <strong>Your store is paused.</strong> Buyers cannot see your products right now.
        </div>
      )}

      <section className="stack" aria-labelledby="todo-h">
        <h2 id="todo-h">To do</h2>
        {todo.length ? (
          <ul className="list panel" style={{ padding: 0 }}>
            {todo.map((t) => (
              <li key={t.href}>
                <Link href={t.href} className="order-row" style={{ gridTemplateColumns: "1fr auto" }}>
                  <span>{t.label}</span>
                  <ChevronIcon />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Nothing waiting on you. {live} products are live.</p>
        )}
      </section>

      <section className="stack" aria-labelledby="sync-h">
        <div className="row row--between">
          <h2 id="sync-h">Product sync</h2>
          {store.sourceType !== "MANUAL" && (
            <form action={resyncStore}>
              <button className="btn btn--secondary btn--sm">Sync now</button>
            </form>
          )}
        </div>
        <p className="small muted">
          {store.sourceType === "MANUAL"
            ? "Your products are added by hand. "
            : `Products come from ${SOURCE[store.sourceType]}${store.sourceUrl && store.sourceType !== "INSTAGRAM" ? ` (${store.sourceUrl.replace(/^https?:\/\//, "")})` : ""}. Prices and stock update every day${store.lastSyncedAt ? `, last on ${store.lastSyncedAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : ""}. `}
          <Link href="/sell/import">Import from somewhere else</Link>
        </p>
        {jobs.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Source</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="num">{j.createdAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
                    <td>{j.sourceUrl.startsWith("instagram:") ? "Instagram" : j.sourceUrl.replace(/^https?:\/\//, "").slice(0, 40)}</td>
                    <td>
                      {j.status === "DONE" ? (
                        <span className="num">{j.created} new, {j.updated} updated</span>
                      ) : j.status === "FAILED" ? (
                        <span className="badge badge--accent" title={j.error ?? ""}>Failed</span>
                      ) : (
                        <Link href={`/sell/import?job=${j.id}`}>Running</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
