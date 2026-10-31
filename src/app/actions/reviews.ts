"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth";

export type ReviewState = { error?: string; ok?: boolean };

export async function submitReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const user = await requireUser();
  const orderItemId = String(formData.get("orderItemId") ?? "");
  const rating = Number(formData.get("rating"));
  const body = String(formData.get("body") ?? "").trim().slice(0, 1000);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Choose 1 to 5 stars" };

  const item = await db.orderItem.findFirst({
    where: { id: orderItemId, sellerOrder: { status: "DELIVERED", order: { userId: user.id } } },
    include: { review: true, sellerOrder: { select: { orderId: true } } },
  });
  if (!item) return { error: "You can review items after they are delivered" };
  if (item.review) return { error: "You already reviewed this item" };

  await db.$transaction(async (tx) => {
    await tx.review.create({
      data: { productId: item.productId, userId: user.id, orderItemId: item.id, rating, body: body || null },
    });
    const agg = await tx.review.aggregate({ where: { productId: item.productId }, _avg: { rating: true }, _count: true });
    await tx.product.update({
      where: { id: item.productId },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
    });
  });
  revalidatePath(`/orders/${item.sellerOrder.orderId}`);
  return { ok: true };
}
