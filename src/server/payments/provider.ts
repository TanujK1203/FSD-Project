/**
 * Payment gateway boundary. The mock provider is used until a real gateway (e.g. Razorpay Route,
 * which can split each payment straight to seller bank accounts) is plugged in behind this interface.
 */
export type CreatePaymentInput = { orderId: string; orderNumber: string; amountPaise: number };
export type CreatePaymentResult = { paymentId: string; redirectUrl: string };

export interface PaymentProvider {
  name: string;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  refund?(paymentId: string, amountPaise: number): Promise<void>;
}
