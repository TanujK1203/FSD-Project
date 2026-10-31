import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { formatPaise } from "@/lib/money";
import { OrderStatusBadge } from "@/components/OrderBits";

export const metadata: Metadata = { title: "Your orders" };

export default async function OrdersPage() {
  const user = await requireUser("/orders");
  const orders = await db.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      sellerOrders: {
        include: { store: { select: { name: true } }, items: { take: 3, select: { imageUrl: true, title: true } } },
      },
    },
    take: 50,
  });

  return (
    <div className="container container--narrow stack-lg">
      <h1>Your orders</h1>
      {orders.length === 0 ? (
        <div className="empty">
          <h2>No orders yet</h2>
          <Link href="/" className="btn btn--secondary">
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="list panel" style={{ padding: 0 }}>
          {orders.map((o) => {
            const thumbs = o.sellerOrders.flatMap((so) => so.items).slice(0, 3);
            return (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="order-row">
                  <span className="order-row__thumbs">
                    {thumbs.map((t, i) =>
                      t.imageUrl ? <img key={i} className="thumb thumb--sm" src={t.imageUrl} alt="" referrerPolicy="no-referrer" /> : <span key={i} className="thumb thumb--sm" />,
                    )}
                  </span>
                  <span className="stack-sm" style={{ gap: 2, minWidth: 0 }}>
                    <span className="strong num">{o.number}</span>
                    <span className="xsmall muted">
                      {o.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      {", "}
                      {o.sellerOrders.map((s) => s.store.name).join(", ")}
                    </span>
                  </span>
                  <span className="stack-sm" style={{ gap: 4, justifyItems: "end" }}>
                    <span className="price num">{formatPaise(o.totalPaise)}</span>
                    <OrderStatusBadge order={o} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
