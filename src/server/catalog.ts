import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { searchWords, tokens } from "@/lib/text";

export const visibleProduct: Prisma.ProductWhereInput = {
  status: "PUBLISHED",
  store: { status: "APPROVED" },
};

export const cardSelect = {
  id: true,
  slug: true,
  title: true,
  pricePaise: true,
  compareAtPaise: true,
  ratingAvg: true,
  ratingCount: true,
  category: true,
  createdAt: true,
  images: { orderBy: { position: "asc" }, take: 1, select: { url: true, alt: true } },
  store: { select: { name: true, slug: true } },
  variants: {
    where: { available: true },
    orderBy: { position: "asc" },
    take: 2,
    select: { id: true, stock: true },
  },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

export type CardProduct = {
  id: string;
  slug: string;
  title: string;
  pricePaise: number;
  compareAtPaise: number | null;
  ratingAvg: number;
  ratingCount: number;
  imageUrl: string | null;
  imageAlt: string | null;
  storeName: string;
  storeSlug: string;
  /** set when the product has exactly one buyable variant, so the card can add it directly */
  quickAddVariantId: string | null;
  soldOut: boolean;
};

export function toCard(p: CardRow): CardProduct {
  const buyable = p.variants.filter((v) => v.stock === null || v.stock > 0);
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    pricePaise: p.pricePaise,
    compareAtPaise: p.compareAtPaise,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    imageUrl: p.images[0]?.url ?? null,
    imageAlt: p.images[0]?.alt ?? null,
    storeName: p.store.name,
    storeSlug: p.store.slug,
    quickAddVariantId: p.variants.length === 1 && buyable.length === 1 ? buyable[0]!.id : null,
    soldOut: buyable.length === 0,
  };
}

export async function getHome() {
  const [latest, stores, categoryCounts] = await Promise.all([
    db.product.findMany({
      where: visibleProduct,
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: cardSelect,
    }),
    db.store.findMany({
      where: { status: "APPROVED", products: { some: { status: "PUBLISHED" } } },
      orderBy: { approvedAt: "desc" },
      take: 12,
      select: {
        name: true,
        slug: true,
        logoUrl: true,
        city: true,
        _count: { select: { products: { where: { status: "PUBLISHED" } } } },
        // stores without a logo show their newest product photo instead
        products: {
          where: { status: "PUBLISHED", images: { some: {} } },
          orderBy: { publishedAt: "desc" },
          take: 1,
          select: { images: { orderBy: { position: "asc" }, take: 1, select: { url: true } } },
        },
      },
    }),
    db.product.groupBy({ by: ["category"], where: visibleProduct, _count: { _all: true } }),
  ]);
  return {
    latest: latest.map(toCard),
    stores: stores.map(({ products, ...s }) => ({
      ...s,
      thumbUrl: s.logoUrl ?? products[0]?.images[0]?.url ?? null,
      isLogo: !!s.logoUrl,
    })),
    categories: new Map(categoryCounts.map((c) => [c.category, c._count._all])),
  };
}

export type SearchParams = {
  q?: string;
  category?: string;
  store?: string;
  min?: string;
  max?: string;
  rating?: string;
  sort?: string;
  page?: string;
};

export const SORTS = [
  { value: "relevance", label: "Best match" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
] as const;

const PAGE_SIZE = 24;

export async function searchProducts(params: SearchParams) {
  const q = (params.q ?? "").trim().slice(0, 80);
  const terms = searchWords(q);
  const where: Prisma.ProductWhereInput = { ...visibleProduct, AND: [] };
  const and = where.AND as Prisma.ProductWhereInput[];

  // match from the start of a word, so "men" does not also find "women"
  for (const t of terms) {
    and.push({
      OR: [{ searchText: { startsWith: t } }, { searchText: { contains: ` ${t}` } }, { searchText: { contains: `-${t}` } }],
    });
  }
  if (params.category) and.push({ category: params.category });
  if (params.store) and.push({ store: { slug: params.store } });
  let min = params.min ? Number(params.min) : NaN;
  let max = params.max ? Number(params.max) : NaN;
  if (min > max) [min, max] = [max, min];
  if (Number.isFinite(min)) and.push({ pricePaise: { gte: Math.round(min * 100) } });
  if (Number.isFinite(max)) and.push({ pricePaise: { lte: Math.round(max * 100) } });
  const rating = Number(params.rating);
  if (params.rating && Number.isFinite(rating)) and.push({ ratingAvg: { gte: rating }, ratingCount: { gt: 0 } });

  const sort = SORTS.some((s) => s.value === params.sort) ? params.sort! : terms.length ? "relevance" : "newest";
  const total = await db.product.count({ where });
  // an old link can point past the last page once filters or stock change
  const page = Math.min(Math.max(1, Number(params.page) || 1), Math.max(1, Math.ceil(total / PAGE_SIZE)));

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sort === "price_asc"
      ? [{ pricePaise: "asc" }]
      : sort === "price_desc"
        ? [{ pricePaise: "desc" }]
        : sort === "rating"
          ? [{ ratingAvg: "desc" }, { ratingCount: "desc" }, { publishedAt: "desc" }]
          : [{ publishedAt: "desc" }];

  if (sort === "relevance" && terms.length) {
    // rank in memory: title hits beat description/tag hits
    const rows = await db.product.findMany({
      where,
      take: 500,
      orderBy: { publishedAt: "desc" },
      select: { ...cardSelect, searchText: true },
    });
    const scored = rows
      .map((r) => {
        const title = r.title.toLowerCase();
        let score = 0;
        for (const t of terms) {
          if (title.includes(t)) score += 3;
          if (title.startsWith(t)) score += 1;
        }
        if (title.includes(q.toLowerCase())) score += 4;
        return { r, score };
      })
      .sort((a, b) => b.score - a.score);
    const slice = scored.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((x) => toCard(x.r));
    return { items: slice, total: scored.length, page, pageSize: PAGE_SIZE, sort };
  }

  const items = await db.product.findMany({
    where,
    orderBy,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: cardSelect,
  });
  return { items: items.map(toCard), total, page, pageSize: PAGE_SIZE, sort };
}

export async function getProduct(slug: string) {
  return db.product.findFirst({
    where: { slug, ...visibleProduct },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: { orderBy: { position: "asc" } },
      store: { select: { id: true, name: true, slug: true, city: true, logoUrl: true, bio: true } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { name: true } } },
      },
    },
  });
}

/** Same or similar item from other sellers, for comparing price across stores. */
export async function alsoSoldBy(product: { id: string; title: string; category: string; storeId: string }) {
  const own = new Set(tokens(product.title));
  if (own.size === 0) return [];
  const candidates = await db.product.findMany({
    where: { ...visibleProduct, category: product.category, storeId: { not: product.storeId } },
    take: 300,
    orderBy: { publishedAt: "desc" },
    select: cardSelect,
  });
  const need = own.size <= 2 ? 1 : 2;
  return candidates
    .map((c) => {
      const shared = tokens(c.title).filter((t) => own.has(t)).length;
      return { c, shared };
    })
    .filter((x) => x.shared >= need)
    .sort((a, b) => b.shared - a.shared || a.c.pricePaise - b.c.pricePaise)
    .slice(0, 6)
    .map((x) => toCard(x.c));
}

export async function moreFromStore(storeId: string, excludeId: string) {
  const rows = await db.product.findMany({
    where: { ...visibleProduct, storeId, id: { not: excludeId } },
    orderBy: { publishedAt: "desc" },
    take: 8,
    select: cardSelect,
  });
  return rows.map(toCard);
}

export async function getStorePage(slug: string, params: { category?: string; sort?: string }) {
  const store = await db.store.findFirst({ where: { slug, status: "APPROVED" } });
  if (!store) return null;
  const where: Prisma.ProductWhereInput = { storeId: store.id, status: "PUBLISHED" };
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: params.category ? { ...where, category: params.category } : where,
      orderBy:
        params.sort === "price_asc"
          ? { pricePaise: "asc" }
          : params.sort === "price_desc"
            ? { pricePaise: "desc" }
            : { publishedAt: "desc" },
      take: 200,
      select: cardSelect,
    }),
    db.product.groupBy({ by: ["category"], where, _count: { _all: true } }),
  ]);
  return { store, products: products.map(toCard), categories };
}
