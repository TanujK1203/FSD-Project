import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { formatPaise } from "@/lib/money";
import { mockPayFail, mockPaySucceed } from "@/app/actions/checkout";

export const metadata: Metadata = { title: "Pay" };

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/pay/${id}`);
  const payment = await db.payment.findFirst({
    where: { id, order: { userId: user.id } },
    include: { order: true },
  });
  if (!payment) notFound();
  if (payment.status === "SUCCEEDED") redirect(`/orders/${payment.orderId}`);

  return (
    <div className="container" style={{ maxWidth: 440 }}>
      <div className="panel stack">
        <div className="row row--between">
          <span className="badge">Test payment</span>
          <span className="xsmall muted num">Order {payment.order.number}</span>
        </div>
        <div className="stack-sm">
          <p className="small muted">Amount to pay</p>
          <p className="price num" style={{ fontSize: "var(--fs-2xl)" }}>
            {formatPaise(payment.amountPaise)}
          </p>
        </div>
        <p className="small muted">
          This is a stand-in for the real payment gateway. Choose what happens. No money moves.
        </p>
        <form action={mockPaySucceed}>
          <input type="hidden" name="paymentId" value={payment.id} />
          <button className="btn btn--primary btn--block">Pay {formatPaise(payment.amountPaise)}</button>
        </form>
        <form action={mockPayFail}>
          <input type="hidden" name="paymentId" value={payment.id} />
          <button className="btn btn--ghost btn--block">Simulate a failed payment</button>
        </form>
      </div>
    </div>
  );
}
