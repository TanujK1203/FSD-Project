import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { FLOW, parseAddress } from "@/server/orders";
import { formatPaise } from "@/lib/money";
import { retryPaymentAction } from "@/app/actions/checkout";
import { FULFILLMENT_LABEL, OrderStatusBadge } from "@/components/OrderBits";
import { ReviewForm } from "@/components/ReviewForm";

export const metadata: Metadata = { title: "Order" };

const fmt = (d: Date) =>
  d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const { id } = await params;
  const { placed } = await searchParams;
  const user = await requireUser(`/orders/${id}`);
  const order = await db.order.findFirst({
    where: { id, userId: user.id },
    include: {
      payment: true,
      sellerOrders: {
        include: {
          store: { select: { name: true, slug: true } },
          items: { include: { review: { select: { id: true, rating: true } }, product: { select: { slug: true } } } },
          events: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!order) notFound();
  const address = parseAddress(order.addressJson);

  return (
    <div className="container container--narrow stack-lg">
      {placed && order.status === "PAID" && (
        <div className="notice notice--accent" role="status">
          <strong>Order placed.</strong> Each store will pack and ship its part. You can follow every parcel here.
        </div>
      )}
      <div className="row row--between" style={{ alignItems: "flex-start" }}>
        <div className="stack-sm" style={{ gap: 4 }}>
          <h1 className="num">Order {order.number}</h1>
          <p className="small muted">Placed {fmt(order.createdAt)}</p>
        </div>
        <OrderStatusBadge order={order} />
      </div>

      {(order.status === "PAYMENT_FAILED" || order.status === "PENDING_PAYMENT") && (
        <div className="panel row row--between">
          <p className="small">
            {order.status === "PAYMENT_FAILED" ? "The payment did not go through." : "This order is waiting for payment."}
          </p>
          <form action={retryPaymentAction}>
            <input type="hidden" name="orderId" value={order.id} />
            <button className="btn btn--primary btn--sm">Pay {formatPaise(order.totalPaise)}</button>
          </form>
        </div>
      )}

      {order.sellerOrders.map((so, i) => {
        const reached = new Map(so.events.map((e) => [e.status, e]));
        const cancelled = so.status === "CANCELLED";
        const doneIdx = FLOW.indexOf(so.status);
        return (
          <section key={so.id} className="panel stack" aria-label={`Shipment from ${so.store.name}`}>
            <div className="row row--between">
              <div>
                <p className="xsmall muted">
                  {order.sellerOrders.length > 1 ? `Shipment ${i + 1} of ${order.sellerOrders.length}` : "Shipment"}
                </p>
                <Link href={`/s/${so.store.slug}`} className="strong">
                  {so.store.name}
                </Link>
              </div>
              {so.trackingNumber && (
                <span className="small num">
                  {so.carrier ? `${so.carrier} ` : ""}
                  <span className="strong">{so.trackingNumber}</span>
                </span>
              )}
            </div>

            {order.status === "PAID" &&
              (cancelled ? (
                <p className="small">
                  <span className="badge badge--accent">Cancelled by the store</span>
                </p>
              ) : (
                <ol className="timeline" aria-label="Tracking">
                  {FLOW.map((step, idx) => {
                    const ev = reached.get(step);
                    const done = idx <= doneIdx;
                    return (
                      <li key={step} data-done={done} data-last-done={done && idx === doneIdx}>
                        <span className="dot" />
                        <span className="row row--between" style={{ gap: 8 }}>
                          <span className={done ? "strong" : undefined}>{FULFILLMENT_LABEL[step]}</span>
                          {ev && <span className="xsmall muted">{fmt(ev.createdAt)}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ))}

            <ul className="list">
              {so.items.map((it) => (
                <li key={it.id} className="row" style={{ padding: "10px 0", alignItems: "flex-start", flexWrap: "nowrap" }}>
                  {it.imageUrl ? (
                    <img className="thumb thumb--sm" src={it.imageUrl} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="thumb thumb--sm" />
                  )}
                  <div className="stack-sm" style={{ gap: 2, flex: 1, minWidth: 0 }}>
                    <Link href={`/p/${it.product.slug}`} className="small" style={{ fontWeight: 500 }}>
                      {it.title}
                    </Link>
                    <span className="xsmall muted num">
                      {it.variantName !== "Default" ? `${it.variantName}, ` : ""}Qty {it.quantity}
                    </span>
                    {so.status === "DELIVERED" &&
                      (it.review ? (
                        <span className="xsmall muted">You rated this {it.review.rating} of 5</span>
                      ) : (
                        <ReviewForm orderItemId={it.id} />
                      ))}
                  </div>
                  <span className="small price num">{formatPaise(it.unitPaise * it.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="kv">
              <div>
                <span className="muted">Shipping</span>
                <span>{so.shippingPaise ? formatPaise(so.shippingPaise) : "Free"}</span>
              </div>
            </div>
          </section>
        );
      })}

      <div className="panel" style={{ display: "grid", gap: "var(--s5)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="stack-sm">
          <h2 style={{ fontSize: "var(--fs-md)" }}>Delivery to</h2>
          <p className="small">
            {address.name}
            <br />
            {address.line1}
            {address.line2 ? <>, {address.line2}</> : null}
            <br />
            {address.city}, {address.state} {address.pincode}
            <br />
            <span className="muted">{address.phone}</span>
          </p>
        </div>
        <div className="kv" style={{ alignContent: "start" }}>
          <div>
            <span>Items</span>
            <span>{formatPaise(order.subtotalPaise)}</span>
          </div>
          <div>
            <span>Shipping</span>
            <span>{order.shippingPaise ? formatPaise(order.shippingPaise) : "Free"}</span>
          </div>
          <div className="total">
            <span>{order.status === "PAID" ? "Paid" : "Total"}</span>
            <span>{formatPaise(order.totalPaise)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
