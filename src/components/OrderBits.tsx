import type { FulfillmentStatus, Order, SellerOrder } from "@prisma/client";

export const FULFILLMENT_LABEL: Record<FulfillmentStatus, string> = {
  PLACED: "Placed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export function OrderStatusBadge({ order }: { order: Order & { sellerOrders: Pick<SellerOrder, "status">[] } }) {
  if (order.status === "PENDING_PAYMENT") return <span className="badge">Awaiting payment</span>;
  if (order.status === "PAYMENT_FAILED") return <span className="badge badge--accent">Payment failed</span>;
  if (order.status === "CANCELLED") return <span className="badge">Cancelled</span>;
  const statuses = order.sellerOrders.map((s) => s.status);
  if (statuses.every((s) => s === "DELIVERED")) return <span className="badge badge--ink">Delivered</span>;
  if (statuses.every((s) => s === "CANCELLED")) return <span className="badge">Cancelled</span>;
  if (statuses.some((s) => s === "SHIPPED" || s === "DELIVERED")) return <span className="badge">On the way</span>;
  return <span className="badge">Confirmed</span>;
}
