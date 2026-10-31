"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { CheckoutError, markPaymentFailed, markPaymentSucceeded, placeOrder, retryPayment } from "@/server/orders";

export type CheckoutState = { error?: string };

export async function placeOrderAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const user = await requireUser("/checkout");
  const addressId = String(formData.get("addressId") ?? "");
  let redirectUrl: string;
  try {
    ({ redirectUrl } = await placeOrder(user.id, addressId));
  } catch (e) {
    if (e instanceof CheckoutError) return { error: e.message };
    throw e;
  }
  redirect(redirectUrl);
}

async function ownedPayment(paymentId: string) {
  const user = await requireUser();
  const payment = await db.payment.findFirst({
    where: { id: paymentId, order: { userId: user.id } },
    include: { order: true },
  });
  if (!payment) redirect("/orders");
  return payment;
}

export async function mockPaySucceed(formData: FormData) {
  const payment = await ownedPayment(String(formData.get("paymentId")));
  await markPaymentSucceeded(payment.id);
  revalidatePath("/", "layout");
  redirect(`/orders/${payment.orderId}?placed=1`);
}

export async function mockPayFail(formData: FormData) {
  const payment = await ownedPayment(String(formData.get("paymentId")));
  await markPaymentFailed(payment.id);
  redirect(`/orders/${payment.orderId}`);
}

export async function retryPaymentAction(formData: FormData) {
  const user = await requireUser();
  const result = await retryPayment(String(formData.get("orderId")), user.id);
  if (result) redirect(result.redirectUrl);
  redirect("/orders");
}
