import { db } from "../db";
import { randomToken } from "../crypto";
import type { PaymentProvider } from "./provider";

/** Test gateway: sends the buyer to /pay/[id] where they choose success or failure. */
export const mockProvider: PaymentProvider = {
  name: "MOCK",
  async createPayment({ orderId, amountPaise }) {
    const payment = await db.payment.upsert({
      where: { orderId },
      create: { orderId, provider: "MOCK", providerRef: `mock_${randomToken(9)}`, amountPaise, status: "CREATED" },
      update: { status: "CREATED", amountPaise, providerRef: `mock_${randomToken(9)}` },
    });
    return { paymentId: payment.id, redirectUrl: `/pay/${payment.id}` };
  },
};

export const paymentProvider: PaymentProvider = mockProvider;
