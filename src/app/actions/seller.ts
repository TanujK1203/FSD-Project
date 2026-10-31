"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FulfillmentStatus } from "@prisma/client";
import { db } from "@/server/db";
import { createSession, getCurrentUser, hashPassword, requireSellerStore } from "@/server/auth";
import { mergeGuestCart } from "@/server/cart";
import { createImportJob, runImportJob } from "@/server/import/runner";
import { normalizeInputUrl } from "@/server/import/detect";
import { advanceSellerOrder } from "@/server/orders";
import { saveUploadedImage } from "@/server/media";
import { buildSearchText } from "@/lib/search";
import { isCategory } from "@/lib/categories";
import { rupeesToPaise } from "@/lib/money";
import { randomSuffix, slugify } from "@/lib/text";
import { uniqueProductSlug } from "@/server/import/save";

export type SellerFormState = { error?: string; ok?: boolean; message?: string };

async function uniqueStoreSlug(name: string) {
  const base = slugify(name).slice(0, 40);
  if (!(await db.store.findUnique({ where: { slug: base } }))) return base;
  for (let i = 0; i < 5; i++) {
    const s = `${base}-${randomSuffix(3)}`;
    if (!(await db.store.findUnique({ where: { slug: s } }))) return s;
  }
  return `${base}-${randomSuffix(6)}`;
}

const storeSchema = z.object({
  storeName: z.string().trim().min(2, "Enter your store name").max(60),
  city: z.string().trim().max(60).optional(),
  instagramHandle: z
    .string()
    .trim()
    .transform((s) => s.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, ""))
    .pipe(z.string().regex(/^[a-zA-Z0-9._]{0,30}$/, "That Instagram handle looks off"))
    .optional(),
});

const accountSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.email("Enter a valid email").transform((e) => e.toLowerCase()),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

/** "Join us": create the seller account (if needed) and a pending store. */
export async function startSelling(_prev: SellerFormState, formData: FormData): Promise<SellerFormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const storeParsed = storeSchema.safeParse(raw);
  if (!storeParsed.success) return { error: storeParsed.error.issues[0]?.message };

  let user = await getCurrentUser();
  if (!user) {
    const acc = accountSchema.safeParse(raw);
    if (!acc.success) return { error: acc.error.issues[0]?.message };
    if (await db.user.findUnique({ where: { email: acc.data.email } })) {
      return { error: "An account with this email exists. Sign in first, then come back here." };
    }
    const created = await db.user.create({
      data: { name: acc.data.name, email: acc.data.email, passwordHash: await hashPassword(acc.data.password), role: "SELLER" },
    });
    await createSession(created.id);
    await mergeGuestCart(created.id);
    user = { id: created.id, email: created.email, name: created.name, phone: null, role: "SELLER" };
  }

  const existing = await db.store.findUnique({ where: { ownerId: user.id } });
  if (!existing) {
    await db.store.create({
      data: {
        ownerId: user.id,
        name: storeParsed.data.storeName,
        slug: await uniqueStoreSlug(storeParsed.data.storeName),
        city: storeParsed.data.city || null,
        instagramHandle: storeParsed.data.instagramHandle || null,
      },
    });
    if (user.role === "BUYER") await db.user.update({ where: { id: user.id }, data: { role: "SELLER" } });
  }
  redirect("/sell/import");
}

export async function startImport(_prev: SellerFormState, formData: FormData): Promise<SellerFormState> {
  const { store } = await requireSellerStore("/sell/import");
  const input = String(formData.get("url") ?? "");
  const url = normalizeInputUrl(input);
  if (!url) return { error: "Paste the full link to your store, like yourstore.in" };
  if (/(^|\.)(instagram\.com|instagr\.am)$/i.test(url.hostname)) {
    return { error: "That is an Instagram link. Use Connect Instagram below instead." };
  }
  const job = await createImportJob(store.id, url.toString(), "initial");
  after(() => runImportJob(job.id));
  redirect(`/sell/import?job=${job.id}`);
}

export async function resyncStore() {
  const { store } = await requireSellerStore();
  const source = store.sourceType === "INSTAGRAM" ? (store.igToken ? "instagram:me" : null) : store.sourceUrl;
  if (!source) redirect("/sell/import");
  const job = await createImportJob(store.id, source, "resync");
  after(() => runImportJob(job.id));
  redirect(`/sell/import?job=${job.id}`);
}

export async function saveDraft(formData: FormData) {
  const { store } = await requireSellerStore();
  const id = String(formData.get("id"));
  const product = await db.product.findFirst({ where: { id, storeId: store.id } });
  if (!product) return;
  const title = String(formData.get("title") ?? "").trim().slice(0, 140) || product.title;
  const price = rupeesToPaise(String(formData.get("price") ?? ""));
  const category = String(formData.get("category") ?? product.category);
  const pricePaise = price && price > 0 ? price : product.pricePaise;
  await db.product.update({
    where: { id },
    data: {
      title,
      category: isCategory(category) ? category : product.category,
      pricePaise,
      compareAtPaise: product.compareAtPaise && product.compareAtPaise > pricePaise ? product.compareAtPaise : null,
      needsReview: pricePaise > 0 ? null : "Price missing",
      searchText: buildSearchText({ title, tags: product.tags, category, storeName: store.name, description: product.description }),
    },
  });
  // single-price products: keep variant prices in step with the product price
  if (price && price > 0) {
    await db.productVariant.updateMany({ where: { productId: id, pricePaise: product.pricePaise }, data: { pricePaise: price } });
  }
  revalidatePath("/sell/review");
  revalidatePath("/seller/products");
}

export async function bulkProducts(formData: FormData) {
  const { store } = await requireSellerStore();
  const ids = formData.getAll("ids").map(String);
  const op = String(formData.get("op"));
  if (!ids.length) return;
  if (op === "publish") {
    await db.product.updateMany({
      where: { id: { in: ids }, storeId: store.id, pricePaise: { gt: 0 } },
      data: { status: "PUBLISHED", publishedAt: new Date(), needsReview: null },
    });
  } else if (op === "unpublish") {
    await db.product.updateMany({ where: { id: { in: ids }, storeId: store.id }, data: { status: "DRAFT" } });
  } else if (op === "archive") {
    await db.product.updateMany({ where: { id: { in: ids }, storeId: store.id }, data: { status: "ARCHIVED" } });
  } else if (op === "delete") {
    // products with orders are archived instead of deleted
    const withOrders = await db.orderItem.findMany({ where: { productId: { in: ids } }, select: { productId: true } });
    const keep = new Set(withOrders.map((o) => o.productId));
    await db.product.updateMany({ where: { id: { in: [...keep] }, storeId: store.id }, data: { status: "ARCHIVED" } });
    await db.product.deleteMany({ where: { id: { in: ids.filter((i) => !keep.has(i)) }, storeId: store.id } });
  }
  revalidatePath("/sell/review");
  revalidatePath("/seller/products");
  revalidatePath("/seller");
}

const variantLine = /^(.+?)\s*(?:[:=]\s*(\d+))?$/;

/** Full product editor (manual add and edit). */
export async function saveProduct(_prev: SellerFormState, formData: FormData): Promise<SellerFormState> {
  const { store } = await requireSellerStore();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim().slice(0, 5000);
  const category = String(formData.get("category") ?? "other");
  const price = rupeesToPaise(String(formData.get("price") ?? ""));
  const compareAt = rupeesToPaise(String(formData.get("compareAt") ?? ""));
  const optionName = String(formData.get("optionName") ?? "").trim() || "Size";
  const optionLines = String(formData.get("options") ?? "")
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
  const stockRaw = String(formData.get("stock") ?? "").trim();
  const stock = stockRaw === "" ? null : Math.max(0, Math.floor(Number(stockRaw)) || 0);
  const removeImages = formData.getAll("removeImage").map(String);
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);

  if (title.length < 2) return { error: "Add a product name" };
  if (!price || price <= 0) return { error: "Add a price" };
  if (!isCategory(category)) return { error: "Choose a category" };

  const uploaded: string[] = [];
  try {
    for (const f of files.slice(0, 8)) uploaded.push(await saveUploadedImage(f, store.id));
  } catch (e) {
    return { error: (e as Error).message };
  }

  const variants = optionLines.length
    ? optionLines.map((line, i) => {
        const m = line.match(variantLine);
        const value = (m?.[1] ?? line).slice(0, 40);
        const s = m?.[2] !== undefined ? Number(m[2]) : stock;
        return { name: value, optionsJson: JSON.stringify({ [optionName]: value }), pricePaise: price, stock: s, available: true, position: i };
      })
    : [{ name: "Default", optionsJson: "{}", pricePaise: price, stock, available: true, position: 0 }];

  const common = {
    title: title.slice(0, 140),
    description,
    category,
    pricePaise: price,
    compareAtPaise: compareAt && compareAt > price ? compareAt : null,
    needsReview: null,
    searchText: buildSearchText({ title, category, storeName: store.name, description }),
  };

  if (!id) {
    const product = await db.product.create({
      data: {
        ...common,
        storeId: store.id,
        slug: await uniqueProductSlug(title),
        status: formData.get("publish") === "on" ? "PUBLISHED" : "DRAFT",
        publishedAt: formData.get("publish") === "on" ? new Date() : null,
        images: { create: uploaded.map((url, i) => ({ url, position: i })) },
        variants: { create: variants },
      },
    });
    revalidatePath("/seller/products");
    redirect(`/seller/products/${product.id}?saved=1`);
  }

  const product = await db.product.findFirst({ where: { id, storeId: store.id }, include: { variants: true, images: true } });
  if (!product) return { error: "Product not found" };

  await db.$transaction(async (tx) => {
    await tx.product.update({ where: { id }, data: common });
    if (removeImages.length) await tx.productImage.deleteMany({ where: { productId: id, id: { in: removeImages } } });
    const maxPos = product.images.reduce((m, i) => Math.max(m, i.position), -1);
    for (const [i, url] of uploaded.entries()) {
      await tx.productImage.create({ data: { productId: id, url, position: maxPos + 1 + i } });
    }
    // update variants in place by name; mark removed ones unavailable (orders may point at them)
    const keep = new Set<string>();
    for (const v of variants) {
      const match = product.variants.find((pv) => pv.name === v.name);
      if (match) {
        keep.add(match.id);
        await tx.productVariant.update({
          where: { id: match.id },
          data: { pricePaise: v.pricePaise, stock: v.stock, available: true, optionsJson: v.optionsJson, position: v.position },
        });
      } else {
        const created = await tx.productVariant.create({ data: { ...v, productId: id } });
        keep.add(created.id);
      }
    }
    await tx.productVariant.updateMany({ where: { productId: id, id: { notIn: [...keep] } }, data: { available: false } });
  });
  revalidatePath(`/seller/products/${id}`);
  revalidatePath("/seller/products");
  return { ok: true, message: "Saved" };
}

export async function updateStore(_prev: SellerFormState, formData: FormData): Promise<SellerFormState> {
  const { store } = await requireSellerStore();
  const parsed = storeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const bio = String(formData.get("bio") ?? "").trim().slice(0, 500);
  const payoutUpi = String(formData.get("payoutUpi") ?? "").trim();
  if (payoutUpi && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(payoutUpi)) return { error: "That UPI ID looks off (example: name@okbank)" };
  const logo = formData.get("logo");
  let logoUrl = store.logoUrl;
  if (logo instanceof File && logo.size > 0) {
    try {
      logoUrl = await saveUploadedImage(logo, store.id);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }
  await db.store.update({
    where: { id: store.id },
    data: {
      name: parsed.data.storeName,
      city: parsed.data.city || null,
      instagramHandle: parsed.data.instagramHandle || null,
      bio: bio || null,
      payoutUpi: payoutUpi || null,
      logoUrl,
    },
  });
  revalidatePath("/seller/settings");
  return { ok: true, message: "Store details saved" };
}

export async function advanceOrder(_prev: SellerFormState, formData: FormData): Promise<SellerFormState> {
  const { store } = await requireSellerStore();
  try {
    await advanceSellerOrder(store.id, String(formData.get("sellerOrderId")), String(formData.get("to")) as FulfillmentStatus, {
      carrier: String(formData.get("carrier") ?? ""),
      trackingNumber: String(formData.get("trackingNumber") ?? ""),
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/seller/orders");
  return { ok: true };
}

export async function disconnectInstagram() {
  const { store } = await requireSellerStore();
  await db.store.update({ where: { id: store.id }, data: { igToken: null, igUserId: null, igTokenExpiresAt: null } });
  revalidatePath("/seller/settings");
}
