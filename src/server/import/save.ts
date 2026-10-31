import { db } from "../db";
import { buildSearchText } from "@/lib/search";
import { isCategory } from "@/lib/categories";
import { randomSuffix, slugify } from "@/lib/text";
import type { ImportedProduct } from "./types";

export type SaveResult = "created" | "updated" | "skipped";

function summarize(p: ImportedProduct) {
  const buyable = p.variants.filter((v) => v.pricePaise > 0);
  const cheapest = (buyable.length ? buyable : p.variants).reduce((a, b) => (b.pricePaise < a.pricePaise ? b : a));
  const compareAt = cheapest.compareAtPaise && cheapest.compareAtPaise > cheapest.pricePaise ? cheapest.compareAtPaise : null;
  return { pricePaise: cheapest.pricePaise, compareAtPaise: compareAt };
}

export async function uniqueProductSlug(title: string) {
  const base = slugify(title).slice(0, 50);
  for (let i = 0; i < 5; i++) {
    const slug = `${base}-${randomSuffix(4)}`;
    if (!(await db.product.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  return `${base}-${randomSuffix(8)}`;
}

/**
 * Create a new draft, or refresh price/stock on an existing product.
 * On resync we never overwrite what the seller may have edited (title, description, category, images).
 */
export async function saveImported(storeId: string, storeName: string, p: ImportedProduct): Promise<SaveResult> {
  if (!p.title || !p.variants.length) return "skipped";
  const { pricePaise, compareAtPaise } = summarize(p);
  const needsReview =
    p.needsReview ?? (pricePaise <= 0 ? "Price missing" : p.images.length === 0 ? "No photos" : null);

  const existing = await db.product.findUnique({
    where: { storeId_sourceId: { storeId, sourceId: p.sourceId } },
    include: { variants: true },
  });

  if (!existing) {
    const category = p.category && isCategory(p.category) ? p.category : "other";
    const tags = p.tags.slice(0, 12).join(", ");
    await db.product.create({
      data: {
        storeId,
        title: p.title.slice(0, 140),
        slug: await uniqueProductSlug(p.title),
        description: p.description,
        category,
        tags,
        pricePaise,
        compareAtPaise,
        status: "DRAFT",
        sourceId: p.sourceId,
        sourceUrl: p.sourceUrl ?? null,
        needsReview,
        searchText: buildSearchText({ title: p.title, tags, category, storeName, description: p.description }),
        images: {
          create: p.images.slice(0, 10).map((img, i) => ({ url: img.url, alt: img.alt ?? null, position: i })),
        },
        variants: {
          create: p.variants.slice(0, 100).map((v, i) => ({
            name: v.name.slice(0, 80),
            optionsJson: JSON.stringify(v.options),
            pricePaise: v.pricePaise,
            stock: v.stock ?? null,
            available: v.available,
            sku: v.sku ?? null,
            sourceId: v.sourceId ?? null,
            position: i,
          })),
        },
      },
    });
    return "created";
  }

  // resync: refresh prices and availability
  const seenVariantIds = new Set<string>();
  for (const [i, v] of p.variants.entries()) {
    const match =
      existing.variants.find((ev) => v.sourceId && ev.sourceId === v.sourceId) ??
      existing.variants.find((ev) => ev.name === v.name);
    if (match) {
      seenVariantIds.add(match.id);
      await db.productVariant.update({
        where: { id: match.id },
        data: { pricePaise: v.pricePaise, available: v.available, stock: v.stock ?? match.stock },
      });
    } else {
      const created = await db.productVariant.create({
        data: {
          productId: existing.id,
          name: v.name.slice(0, 80),
          optionsJson: JSON.stringify(v.options),
          pricePaise: v.pricePaise,
          stock: v.stock ?? null,
          available: v.available,
          sku: v.sku ?? null,
          sourceId: v.sourceId ?? null,
          position: existing.variants.length + i,
        },
      });
      seenVariantIds.add(created.id);
    }
  }
  // options that disappeared at the source are kept (orders reference them) but marked unavailable
  const gone = existing.variants.filter((v) => !seenVariantIds.has(v.id)).map((v) => v.id);
  if (gone.length) await db.productVariant.updateMany({ where: { id: { in: gone } }, data: { available: false } });

  await db.product.update({
    where: { id: existing.id },
    data: {
      pricePaise,
      compareAtPaise,
      sourceUrl: p.sourceUrl ?? existing.sourceUrl,
      // keep images fresh only if the seller never had any
      ...(existing.status === "DRAFT" && p.images.length
        ? {
            images: {
              deleteMany: {},
              create: p.images.slice(0, 10).map((img, i) => ({ url: img.url, alt: img.alt ?? null, position: i })),
            },
          }
        : {}),
    },
  });
  return "updated";
}

/** After a complete listing (Shopify/Woo), products no longer at the source are marked sold out. */
export async function markMissingSoldOut(storeId: string, prefix: string, seenSourceIds: Set<string>) {
  const products = await db.product.findMany({
    where: { storeId, sourceId: { startsWith: prefix } },
    select: { id: true, sourceId: true },
  });
  const missing = products.filter((p) => p.sourceId && !seenSourceIds.has(p.sourceId)).map((p) => p.id);
  if (missing.length) {
    await db.productVariant.updateMany({ where: { productId: { in: missing } }, data: { available: false } });
  }
  return missing.length;
}
