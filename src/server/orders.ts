import "server-only";
import type { FulfillmentStatus } from "@prisma/client";
import { db } from "./db";
import { getCartView } from "./cart";
import { payoutFor } from "@/lib/pricing";
import { randomSuffix } from "@/lib/text";
import { paymentProvider } from "./payments/mock";

export class CheckoutError extends Error {}

function orderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${ymd}-${randomSuffix(5).toUpperCase()}`;
}

/** Turn the user's cart into one order split per seller, then hand off to the payment gateway. */
export async function placeOrder(userId: string, addressId: string) {
  const address = await db.address.findFirst({ where: { id: addressId, userId } });
  if (!address) throw new CheckoutError("Choose a delivery address");

  const cart = await db.cart.findUnique({ where: { userId } });
  const view = await getCartView(cart?.id ?? null);
  if (!view.lines.length) throw new CheckoutError("Your cart is empty");
  if (view.hasProblems) throw new CheckoutError("Some items in your cart changed. Review your cart first.");

  const addressSnapshot = {
    name: address.name,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
  };

  const order = await db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        number: orderNumber(),
        userId,
        addressJson: JSON.stringify(addressSnapshot),
        subtotalPaise: view.subtotalPaise,
        shippingPaise: view.shippingPaise,
        totalPaise: view.totalPaise,
      },
    });
    for (const seller of view.sellers) {
      await tx.sellerOrder.create({
        data: {
          orderId: created.id,
          storeId: seller.storeId,
          subtotalPaise: seller.subtotalPaise,
          shippingPaise: seller.shippingPaise,
          items: {
            create: seller.lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              title: l.title,
              variantName: l.variantName,
              imageUrl: l.imageUrl,
              unitPaise: l.unitPaise,
              quantity: l.quantity,
            })),
          },
        },
      });
    }
    return created;
  });

  const payment = await paymentProvider.createPayment({
    orderId: order.id,
    orderNumber: order.number,
    amountPaise: order.totalPaise,
  });
  return { order, redirectUrl: payment.redirectUrl };
}

/** Called by the gateway on success. Idempotent. */
export async function markPaymentSucceeded(paymentId: string) {
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { order: { include: { sellerOrders: { include: { items: true } } } } },
    });
    if (!payment) throw new Error("Payment not found");
    if (payment.status === "SUCCEEDED") return payment.order;

    await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED" } });
    await tx.order.update({ where: { id: payment.orderId }, data: { status: "PAID", paidAt: new Date() } });

    const variantIds: string[] = [];
    for (const so of payment.order.sellerOrders) {
      await tx.orderEvent.create({ data: { sellerOrderId: so.id, status: "PLACED" } });
      const p = payoutFor(so.subtotalPaise, so.shippingPaise);
      await tx.payout.create({ data: { storeId: so.storeId, sellerOrderId: so.id, ...p, status: "ON_HOLD" } });
      for (const item of so.items) {
        variantIds.push(item.variantId);
        const v = await tx.productVariant.findUnique({ where: { id: item.variantId } });
        if (v && v.stock !== null) {
          await tx.productVariant.update({
            where: { id: v.id },
            data: { stock: Math.max(0, v.stock - item.quantity) },
          });
        }
      }
    }
    // clear what was bought from the buyer's cart
    const cart = await tx.cart.findUnique({ where: { userId: payment.order.userId } });
    if (cart) await tx.cartItem.deleteMany({ where: { cartId: cart.id, variantId: { in: variantIds } } });
    return payment.order;
  });
}

export async function markPaymentFailed(paymentId: string) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status === "SUCCEEDED") return;
  await db.payment.update({ where: { id: paymentId }, data: { status: "FAILED" } });
  await db.order.update({ where: { id: payment.orderId }, data: { status: "PAYMENT_FAILED" } });
}

export async function retryPayment(orderId: string, userId: string) {
  const order = await db.order.findFirst({ where: { id: orderId, userId } });
  if (!order || order.status === "PAID" || order.status === "CANCELLED") return null;
  await db.order.update({ where: { id: order.id }, data: { status: "PENDING_PAYMENT" } });
  return paymentProvider.createPayment({ orderId: order.id, orderNumber: order.number, amountPaise: order.totalPaise });
}

export const FLOW: FulfillmentStatus[] = ["PLACED", "PACKED", "SHIPPED", "DELIVERED"];

export function nextStatus(current: FulfillmentStatus): FulfillmentStatus | null {
  const i = FLOW.indexOf(current);
  return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1]! : null;
}

/** Seller moves a shipment forward one step. */
export async function advanceSellerOrder(
  storeId: string,
  sellerOrderId: string,
  to: FulfillmentStatus,
  extra: { carrier?: string; trackingNumber?: string } = {},
) {
  const so = await db.sellerOrder.findFirst({
    where: { id: sellerOrderId, storeId, order: { status: "PAID" } },
  });
  if (!so) throw new Error("Order not found");
  if (to === "CANCELLED") {
    if (so.status === "SHIPPED" || so.status === "DELIVERED") throw new Error("Shipped orders cannot be cancelled");
  } else if (nextStatus(so.status) !== to) {
    throw new Error("That step is not next for this order");
  }
  if (to === "SHIPPED" && !extra.trackingNumber?.trim()) throw new Error("Add a tracking number to mark as shipped");

  await db.$transaction(async (tx) => {
    await tx.sellerOrder.update({
      where: { id: so.id },
      data: {
        status: to,
        ...(to === "SHIPPED" ? { carrier: extra.carrier?.trim() || null, trackingNumber: extra.trackingNumber!.trim() } : {}),
      },
    });
    await tx.orderEvent.create({
      data: {
        sellerOrderId: so.id,
        status: to,
        note: to === "SHIPPED" ? `${extra.carrier?.trim() || "Courier"} ${extra.trackingNumber?.trim()}` : null,
      },
    });
    if (to === "DELIVERED") {
      await tx.payout.updateMany({ where: { sellerOrderId: so.id, status: "ON_HOLD" }, data: { status: "READY" } });
    }
    if (to === "CANCELLED") {
      await tx.payout.updateMany({ where: { sellerOrderId: so.id }, data: { status: "CANCELLED" } });
      // put stock back
      const items = await tx.orderItem.findMany({ where: { sellerOrderId: so.id } });
      for (const item of items) {
        const v = await tx.productVariant.findUnique({ where: { id: item.variantId } });
        if (v && v.stock !== null) {
          await tx.productVariant.update({ where: { id: v.id }, data: { stock: v.stock + item.quantity } });
        }
      }
    }
  });
}

export function parseAddress(json: string) {
  return JSON.parse(json) as {
    name: string;
    phone: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    pincode: string;
  };
}
