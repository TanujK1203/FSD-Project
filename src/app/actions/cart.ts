"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { ensureCartId, findCartId } from "@/server/cart";
import { COMMERCE } from "@/config";

export type CartActionState = { ok: boolean; message?: string; at?: number };

export async function addToCart(_prev: CartActionState, formData: FormData): Promise<CartActionState> {
  const variantId = String(formData.get("variantId") ?? "");
  const quantity = Math.max(1, Math.min(COMMERCE.maxQuantityPerItem, Number(formData.get("quantity")) || 1));
  if (!variantId) return { ok: false, message: "Choose an option first" };

  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { select: { status: true, store: { select: { status: true } } } } },
  });
  if (!variant || variant.product.status !== "PUBLISHED" || variant.product.store.status !== "APPROVED") {
    return { ok: false, message: "This item is no longer available" };
  }
  if (!variant.available || (variant.stock !== null && variant.stock <= 0)) {
    return { ok: false, message: "Out of stock" };
  }

  const cartId = await ensureCartId();
  const existing = await db.cartItem.findUnique({ where: { cartId_variantId: { cartId, variantId } } });
  const cap = Math.min(COMMERCE.maxQuantityPerItem, variant.stock ?? COMMERCE.maxQuantityPerItem);
  const next = Math.min(cap, (existing?.quantity ?? 0) + quantity);
  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId } },
    create: { cartId, variantId, quantity: next },
    update: { quantity: next },
  });
  revalidatePath("/", "layout");
  return { ok: true, at: Date.now(), message: next === cap && existing ? `Max ${cap} per order` : undefined };
}

async function ownedItem(itemId: string) {
  const cartId = await findCartId();
  if (!cartId) return null;
  return db.cartItem.findFirst({ where: { id: itemId, cartId }, include: { variant: true } });
}

export async function setQuantity(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  const quantity = Number(formData.get("quantity"));
  const item = await ownedItem(itemId);
  if (!item) return;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    await db.cartItem.delete({ where: { id: item.id } });
  } else {
    const cap = Math.min(COMMERCE.maxQuantityPerItem, item.variant.stock ?? COMMERCE.maxQuantityPerItem);
    await db.cartItem.update({ where: { id: item.id }, data: { quantity: Math.min(cap, Math.floor(quantity)) } });
  }
  revalidatePath("/", "layout");
}

export async function removeItem(formData: FormData) {
  const item = await ownedItem(String(formData.get("itemId") ?? ""));
  if (item) await db.cartItem.delete({ where: { id: item.id } });
  revalidatePath("/", "layout");
}
