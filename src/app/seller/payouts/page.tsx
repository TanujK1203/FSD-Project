import type { Metadata } from "next";
import { requireSellerStore } from "@/server/auth";
import { db } from "@/server/db";
import { formatPaise } from "@/lib/money";
import { COMMERCE } from "@/config";

export const metadata: Metadata = { title: "Payouts" };

const LABEL = { ON_HOLD: "Until delivered", READY: "Ready", SETTLED: "Paid out", CANCELLED: "Cancelled" } as const;

export default async function Payouts() {
  const { store } = await requireSellerStore("/seller/payouts");
  const [rows, sums] = await Promise.all([
    db.payout.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      include: { sellerOrder: { select: { order: { select: { number: true } } } } },
      take: 200,
    }),
    db.payout.groupBy({ by: ["status"], where: { storeId: store.id }, _sum: { netPaise: true } }),
  ]);
  const sum = (s: string) => sums.find((x) => x.status === s)?._sum.netPaise ?? 0;

  return (
    <div className="stack-lg" style={{ maxWidth: 860 }}>
      <div className="kv panel" style={{ maxWidth: 420 }}>
        <div>
          <span>Waiting for delivery</span>
          <span>{formatPaise(sum("ON_HOLD"))}</span>
        </div>
        <div>
          <span>Ready to pay out</span>
          <span>{formatPaise(sum("READY"))}</span>
        </div>
        <div className="total">
          <span>Paid out so far</span>
          <span>{formatPaise(sum("SETTLED"))}</span>
        </div>
      </div>
      <p className="small muted" style={{ maxWidth: "65ch" }}>
        Money for an order becomes ready once it is delivered. We keep {Math.round(COMMERCE.commissionRate * 100)}% of the
        item price; shipping you charged is passed on in full. Payouts go to {store.payoutUpi ? <strong>{store.payoutUpi}</strong> : "the UPI ID in Store details"}.
      </p>
      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th className="num">Sale</th>
                <th className="num">Fee</th>
                <th className="num">You get</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.sellerOrder.order.number}</td>
                  <td className="num">{formatPaise(r.grossPaise)}</td>
                  <td className="num">−{formatPaise(r.commissionPaise)}</td>
                  <td className="num strong">{formatPaise(r.netPaise)}</td>
                  <td>
                    <span className={`badge${r.status === "SETTLED" ? " badge--ink" : r.status === "CANCELLED" ? " badge--accent" : ""}`}>
                      {LABEL[r.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
