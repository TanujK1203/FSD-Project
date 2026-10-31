import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { getCurrentUser } from "./auth";
import { randomToken } from "./crypto";
import { splitBySeller } from "@/lib/pricing";
import { COMMERCE } from "@/config";

const GUEST_COOKIE = "gid";

/** Finds the current cart id without creating anything (safe during render). */
export async function findCartId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user) {
    const cart = await db.cart.findUnique({ where: { userId: user.id }, select: { id: true } });
    return cart?.id ?? null;
  }
  const gid = (await cookies()).get(GUEST_COOKIE)?.value;
  if (!gid) return null;
  const cart = await db.cart.findUnique({ where: { guestId: gid }, select: { id: true } });
  return cart?.id ?? null;
}

/** Finds or creates the cart. Only call from server actions or route handlers (may set a cookie). */
export async function ensureCartId(): Promise<string> {
  const user = await getCurrentUser();
  if (user) {
    const cart = await db.cart.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
    return cart.id;
  }
  const jar = await cookies();
  let gid = jar.get(GUEST_COOKIE)?.value;
  if (!gid) {
    gid = randomToken(18);
    jar.set(GUEST_COOKIE, gid, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 60 });
  }
  const cart = await db.cart.upsert({ where: { guestId: gid }, create: { guestId: gid }, update: {} });
  return cart.id;
}

/** Moves guest cart items into the user's cart after sign in. */
export async function mergeGuestCart(userId: string) {
  const jar = await cookies();
  const gid = jar.get(GUEST_COOKIE)?.value;
  if (!gid) return;
  const guest = await db.cart.findUnique({ where: { guestId: gid }, include: { items: true } });
  if (guest && guest.items.length) {
    const cart = await db.cart.upsert({ where: { userId }, create: { userId }, update: {} });
    for (const item of guest.items) {
      const existing = await db.cartItem.findUnique({
        where: { cartId_variantId: { cartId: cart.id, variantId: item.variantId } },
      });
      const quantity = Math.min(COMMERCE.maxQuantityPerItem, (existing?.quantity ?? 0) + item.quantity);
      await db.cartItem.upsert({
        where: { cartId_variantId: { cartId: cart.id, variantId: item.variantId } },
        create: { cartId: cart.id, variantId: item.variantId, quantity },
        update: { quantity },
      });
    }
  }
  if (guest) await db.cart.delete({ where: { id: guest.id } });
  jar.delete(GUEST_COOKIE);
}

export async function cartCount(): Promise<number> {
  const cartId = await findCartId();
  if (!cartId) return 0;
  const agg = await db.cartItem.aggregate({ where: { cartId }, _sum: { quantity: true } });
  return agg._sum.quantity ?? 0;
}

export type CartLine = {
  id: string;
  variantId: string;
  productId: string;
  productSlug: string;
  title: string;
  variantName: string;
  imageUrl: string | null;
  unitPaise: number;
  quantity: number;
  storeId: string;
  storeName: string;
  storeSlug: string;
  problem: string | null; // why this line cannot be bought right now
  maxQuantity: number;
};

export async function getCartView(cartId?: string | null) {
  const id = cartId === undefined ? await findCartId() : cartId;
  const items = id
    ? await db.cartItem.findMany({
        where: { cartId: id },
        orderBy: { createdAt: "asc" },
        include: {
          variant: {
            include: {
              product: {
                include: {
                  store: { select: { id: true, name: true, slug: true, status: true } },
                  images: { orderBy: { position: "asc" }, take: 1 },
                },
              },
            },
          },
        },
      })
    : [];

  const lines: CartLine[] = items.map((item) => {
    const v = item.variant;
    const p = v.product;
    let problem: string | null = null;
    if (p.status !== "PUBLISHED" || p.store.status !== "APPROVED") problem = "No longer available";
    else if (!v.available || (v.stock !== null && v.stock <= 0)) problem = "Out of stock";
    else if (v.stock !== null && v.stock < item.quantity) problem = `Only ${v.stock} left`;
    return {
      id: item.id,
      variantId: v.id,
      productId: p.id,
      productSlug: p.slug,
      title: p.title,
      variantName: v.name,
      imageUrl: p.images[0]?.url ?? null,
      unitPaise: v.pricePaise,
      quantity: item.quantity,
      storeId: p.store.id,
      storeName: p.store.name,
      storeSlug: p.store.slug,
      problem,
      maxQuantity: Math.min(COMMERCE.maxQuantityPerItem, v.stock ?? COMMERCE.maxQuantityPerItem),
    };
  });

  const buyable = lines.filter((l) => !l.problem);
  const split = splitBySeller(buyable);
  return {
    cartId: id,
    lines,
    hasProblems: lines.some((l) => l.problem),
    ...split,
    // keep unbuyable lines visible under their seller
    groups: groupForDisplay(lines, split.sellers),
  };
}

function groupForDisplay(lines: CartLine[], sellers: ReturnType<typeof splitBySeller<CartLine>>["sellers"]) {
  const order: string[] = [];
  const byStore = new Map<string, CartLine[]>();
  for (const l of lines) {
    if (!byStore.has(l.storeId)) {
      byStore.set(l.storeId, []);
      order.push(l.storeId);
    }
    byStore.get(l.storeId)!.push(l);
  }
  return order.map((storeId) => {
    const ls = byStore.get(storeId)!;
    const s = sellers.find((x) => x.storeId === storeId);
    return {
      storeId,
      storeName: ls[0]!.storeName,
      storeSlug: ls[0]!.storeSlug,
      lines: ls,
      subtotalPaise: s?.subtotalPaise ?? 0,
      shippingPaise: s?.shippingPaise ?? 0,
    };
  });
}
