import type { Metadata } from "next";
import Link from "next/link";
import type { FulfillmentStatus } from "@prisma/client";
import { requireSellerStore } from "@/server/auth";
import { db } from "@/server/db";
import { nextStatus, parseAddress } from "@/server/orders";
import { formatPaise } from "@/lib/money";
import { FULFILLMENT_LABEL } from "@/components/OrderBits";
import { FulfilForm } from "@/components/FulfilForm";

export const metadata: Metadata = { title: "Orders" };

const TABS = [
  { key: "open", label: "To ship", statuses: ["PLACED", "PACKED"] as FulfillmentStatus[] },
  { key: "shipped", label: "Shipped", statuses: ["SHIPPED"] as FulfillmentStatus[] },
  { key: "done", label: "Delivered", statuses: ["DELIVERED"] as FulfillmentStatus[] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] as FulfillmentStatus[] },
];

export default async function SellerOrders({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { store } = await requireSellerStore("/seller/orders");
  const tabKey = (await searchParams).tab;
  const tab = TABS.find((t) => t.key === tabKey) ?? TABS[0]!;
  const orders = await db.sellerOrder.findMany({
    where: { storeId: store.id, status: { in: tab.statuses }, order: { status: "PAID" } },
    orderBy: { createdAt: tab.key === "open" ? "asc" : "desc" },
    include: { items: true, order: { select: { number: true, addressJson: true, paidAt: true } }, payout: true },
    take: 100,
  });

  return (
    <div className="stack">
      <nav className="row" style={{ gap: "var(--s2)" }} aria-label="Order status">
        {TABS.map((t) => (
          <Link key={t.key} href={`/seller/orders?tab=${t.key}`} className="chip" aria-current={tab.key === t.key ? "true" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
      {orders.length === 0 ? (
        <div className="empty">
          <p>{tab.key === "open" ? "No orders waiting. New orders show up here." : "Nothing here yet."}</p>
        </div>
      ) : (
        orders.map((so) => {
          const a = parseAddress(so.order.addressJson);
          const next = nextStatus(so.status);
          return (
            <article key={so.id} className="panel stack">
              <div className="row row--between">
                <div>
                  <span className="strong num">Order {so.order.number}</span>
                  <p className="xsmall muted">
                    Paid {so.order.paidAt?.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
                <span className={`badge${so.status === "DELIVERED" ? " badge--ink" : so.status === "CANCELLED" ? " badge--accent" : ""}`}>
                  {FULFILLMENT_LABEL[so.status]}
                </span>
              </div>
              <ul className="list">
                {so.items.map((it) => (
                  <li key={it.id} className="row" style={{ padding: "8px 0", flexWrap: "nowrap" }}>
                    {it.imageUrl ? <img className="thumb thumb--sm" src={it.imageUrl} alt="" referrerPolicy="no-referrer" /> : <span className="thumb thumb--sm" />}
                    <span className="small" style={{ flex: 1, minWidth: 0 }}>
                      {it.title}
                      <span className="muted num" style={{ display: "block" }}>
                        {it.variantName !== "Default" ? `${it.variantName}, ` : ""}Qty {it.quantity}
                      </span>
                    </span>
                    <span className="small num">{formatPaise(it.unitPaise * it.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="row row--between" style={{ alignItems: "flex-start" }}>
                <p className="small">
                  <span className="strong">Ship to</span>
                  <br />
                  {a.name}, {a.phone}
                  <br />
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}
                </p>
                {so.payout && (
                  <p className="small" style={{ textAlign: "right" }}>
                    <span className="muted">You receive</span>
                    <br />
                    <span className="strong num">{formatPaise(so.payout.netPaise)}</span>
                  </p>
                )}
              </div>
              {so.trackingNumber && (
                <p className="small muted">
                  Tracking: {so.carrier ? `${so.carrier} ` : ""}
                  <span className="num">{so.trackingNumber}</span>
                </p>
              )}
              {next && <FulfilForm sellerOrderId={so.id} next={next} canCancel={so.status === "PLACED" || so.status === "PACKED"} />}
            </article>
          );
        })
      )}
    </div>
  );
}
