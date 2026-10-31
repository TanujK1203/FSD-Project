import type { Metadata } from "next";
import { db } from "@/server/db";
import { formatPaise } from "@/lib/money";
import { FULFILLMENT_LABEL } from "@/components/OrderBits";

export const metadata: Metadata = { title: "Orders" };

export default async function AdminOrders() {
  const orders = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true } }, sellerOrders: { include: { store: { select: { name: true } } } } },
  });
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Buyer</th>
            <th>Payment</th>
            <th>Shipments</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="num">
                {o.number}
                <div className="xsmall muted">{o.createdAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</div>
              </td>
              <td className="small">{o.user.email}</td>
              <td>
                <span className={`badge${o.status === "PAID" ? " badge--ink" : o.status === "PAYMENT_FAILED" ? " badge--accent" : ""}`}>
                  {o.status === "PAID" ? "Paid" : o.status === "PAYMENT_FAILED" ? "Failed" : o.status === "PENDING_PAYMENT" ? "Pending" : "Cancelled"}
                </span>
              </td>
              <td className="small">
                {o.sellerOrders.map((s) => (
                  <div key={s.id}>
                    {s.store.name}: {FULFILLMENT_LABEL[s.status]}
                  </div>
                ))}
              </td>
              <td className="num">{formatPaise(o.totalPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
