import { guessCategory } from "@/lib/categories";
import { minorToPaise } from "@/lib/money";
import { htmlToText } from "@/lib/text";
import { parseJson, safeFetchRetry } from "../safeFetch";
import type { Adapter, ImportedProduct, ImportedVariant } from "../types";

export type WooProduct = {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  type?: string;
  description?: string;
  short_description?: string;
  prices: {
    price: string;
    regular_price: string;
    sale_price: string;
    currency_code: string;
    currency_minor_unit: number;
  };
  images: { src: string; alt?: string }[];
  categories?: { name: string }[];
  tags?: { name: string }[];
  attributes?: { name: string; terms?: { name: string }[]; has_variations?: boolean }[];
  variations?: { id: number; attributes: { name: string; value: string | null }[] }[];
  is_in_stock?: boolean;
  is_purchasable?: boolean;
  low_stock_remaining?: number | null;
};

export function mapWooProduct(p: WooProduct): ImportedProduct | null {
  const minor = p.prices?.currency_minor_unit ?? 2;
  const price = minorToPaise(p.prices?.price, minor);
  const regular = minorToPaise(p.prices?.regular_price, minor);
  if (price === null) return null;
  const compareAt = regular && regular > price ? regular : null;
  const available = p.is_in_stock !== false;
  const title = htmlToText(p.name);
  const tags = (p.tags ?? []).map((t) => htmlToText(t.name));
  const cats = (p.categories ?? []).map((c) => htmlToText(c.name));

  let variants: ImportedVariant[];
  if (p.variations?.length) {
    // The public Store API returns variation attributes but not per-variation prices; use the parent price.
    variants = p.variations.map((v) => {
      const options: Record<string, string> = {};
      for (const a of v.attributes) if (a.value) options[htmlToText(a.name)] = htmlToText(a.value);
      const name = Object.values(options).join(" / ") || "Default";
      return { sourceId: String(v.id), name, options, pricePaise: price, compareAtPaise: compareAt, available, stock: null };
    });
  } else {
    variants = [
      {
        sourceId: String(p.id),
        name: "Default",
        options: {},
        pricePaise: price,
        compareAtPaise: compareAt,
        available,
        stock: p.low_stock_remaining ?? null,
      },
    ];
  }

  const currency = p.prices?.currency_code ?? null;
  return {
    sourceId: `woo:${p.id}`,
    sourceUrl: p.permalink,
    title,
    description: htmlToText(p.description || p.short_description),
    category: guessCategory(cats.join(" "), tags.join(" "), title),
    tags: [...cats, ...tags],
    images: (p.images ?? []).map((i) => ({ url: i.src, alt: i.alt || null })),
    variants,
    currency,
    needsReview:
      currency && currency !== "INR"
        ? `Prices are in ${currency}`
        : p.variations?.length
          ? "Check prices for each option"
          : null,
  };
}

export const wooAdapter: Adapter = {
  name: "woocommerce",
  complete: true,
  async *run(url, ctx) {
    const base = `${url.origin}/wp-json/wc/store/v1/products`;
    let count = 0;
    let warnedCurrency = false;
    for (let page = 1; page <= 60 && count < ctx.maxProducts; page++) {
      const res = await safeFetchRetry(`${base}?per_page=100&page=${page}`, { accept: "application/json" });
      const json = parseJson<WooProduct[]>(res);
      if (!Array.isArray(json)) {
        if (page === 1) throw new Error("Could not read this WooCommerce store's product list");
        break;
      }
      if (json.length === 0) break;
      ctx.found(json.length);
      ctx.log(`Read page ${page}: ${json.length} products`);
      for (const p of json) {
        if (count >= ctx.maxProducts) break;
        const mapped = mapWooProduct(p);
        if (!mapped) continue;
        if (!warnedCurrency && mapped.currency && mapped.currency !== "INR") {
          ctx.log(`Store prices are in ${mapped.currency}. Check prices before publishing.`, "warn");
          warnedCurrency = true;
        }
        count++;
        yield mapped;
      }
      const totalPages = Number(res.headers.get("x-wp-totalpages"));
      if (json.length < 100 || (totalPages && page >= totalPages)) break;
    }
  },
};
