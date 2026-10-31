import type { Metadata } from "next";
import { db } from "@/server/db";
import { formatPaise } from "@/lib/money";
import { settlePayouts } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Payouts" };

export default async function AdminPayouts() {
  const ready = await db.payout.findMany({
    where: { status: "READY" },
    orderBy: { createdAt: "asc" },
    include: { store: { select: { id: true, name: true, payoutUpi: true } }, sellerOrder: { select: { order: { select: { number: true } } } } },
  });
  const byStore = new Map<string, typeof ready>();
  for (const p of ready) byStore.set(p.store.id, [...(byStore.get(p.store.id) ?? []), p]);

  return (
    <div className="stack">
      <p className="small muted" style={{ maxWidth: "70ch" }}>
        Delivered orders ready to pay out. With the test gateway, pay sellers yourself (UPI or bank) and mark them paid here.
        A real gateway with split settlement (for example Razorpay Route) would do this automatically.
      </p>
      {byStore.size === 0 && (
        <div className="empty">
          <p>Nothing to pay out right now.</p>
        </div>
      )}
      {[...byStore.values()].map((rows) => {
        const s = rows[0]!.store;
        const total = rows.reduce((t, r) => t + r.netPaise, 0);
        return (
          <form key={s.id} action={settlePayouts} className="panel stack-sm">
            <div className="row row--between">
              <div>
                <span className="strong">{s.name}</span>
                <div className="xsmall muted">{s.payoutUpi ? `UPI ${s.payoutUpi}` : "No UPI ID yet"}</div>
              </div>
              <div className="row">
                <span className="price num">{formatPaise(total)}</span>
                <button className="btn btn--secondary btn--sm">Mark {rows.length} paid</button>
              </div>
            </div>
            <ul className="list small">
              {rows.map((r) => (
                <li key={r.id} className="row row--between" style={{ padding: "6px 0" }}>
                  <input type="hidden" name="ids" value={r.id} />
                  <span className="num">Order {r.sellerOrder.order.number}</span>
                  <span className="num">{formatPaise(r.netPaise)}</span>
                </li>
              ))}
            </ul>
          </form>
        );
      })}
    </div>
  );
}
