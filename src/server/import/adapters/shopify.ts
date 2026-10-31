import { guessCategory } from "@/lib/categories";
import { rupeesToPaise } from "@/lib/money";
import { htmlToText } from "@/lib/text";
import { parseJson, safeFetch, safeFetchRetry } from "../safeFetch";
import type { Adapter, ImportedProduct, ImportedVariant } from "../types";

type ShopifyVariant = {
  id: number;
  title: string;
  price: string;
  compare_at_price: string | null;
  available?: boolean;
  sku?: string | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
};

export type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  body_html: string | null;
  product_type?: string;
  vendor?: string;
  tags: string[] | string;
  options?: { name: string; values?: string[] }[];
  variants: ShopifyVariant[];
  images: { src: string; alt?: string | null; position?: number }[];
};

export function mapShopifyProduct(p: ShopifyProduct, origin: string, currency: string | null): ImportedProduct | null {
  if (!p.variants?.length) return null;
  const tags = Array.isArray(p.tags) ? p.tags : String(p.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const optionNames = (p.options ?? []).map((o) => o.name);
  const variants: ImportedVariant[] = p.variants.map((v) => {
    const values = [v.option1, v.option2, v.option3];
    const options: Record<string, string> = {};
    optionNames.forEach((name, i) => {
      const val = values[i];
      if (val && !(name === "Title" && val === "Default Title")) options[name] = val;
    });
    return {
      sourceId: String(v.id),
      name: v.title === "Default Title" ? "Default" : v.title,
      options,
      pricePaise: rupeesToPaise(v.price) ?? 0,
      compareAtPaise: rupeesToPaise(v.compare_at_price),
      available: v.available !== false,
      stock: null,
      sku: v.sku || null,
    };
  });
  const description = htmlToText(p.body_html);
  return {
    sourceId: `shopify:${p.id}`,
    sourceUrl: `${origin}/products/${p.handle}`,
    title: p.title.trim(),
    description,
    category: guessCategory(p.product_type, tags.join(" "), p.title),
    tags,
    images: (p.images ?? [])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((i) => ({ url: i.src.startsWith("//") ? `https:${i.src}` : i.src, alt: i.alt ?? null })),
    variants,
    currency,
    needsReview: currency && currency !== "INR" ? `Prices are in ${currency}` : null,
  };
}

async function detectCurrency(origin: string): Promise<string | null> {
  try {
    const res = await safeFetch(`${origin}/cart.js`, { accept: "application/json" });
    const json = parseJson<{ currency?: string }>(res);
    return json?.currency ?? null;
  } catch {
    return null;
  }
}

export const shopifyAdapter: Adapter = {
  name: "shopify",
  complete: true,
  async *run(url, ctx) {
    const origin = url.origin;
    const currency = await detectCurrency(origin);
    if (currency && currency !== "INR") ctx.log(`Store prices are in ${currency}. Check prices before publishing.`, "warn");
    let count = 0;
    for (let page = 1; page <= 40 && count < ctx.maxProducts; page++) {
      const res = await safeFetchRetry(`${origin}/products.json?limit=250&page=${page}`, { accept: "application/json" });
      const json = parseJson<{ products?: ShopifyProduct[] }>(res);
      if (!json?.products) {
        if (page === 1) throw new Error("Could not read this Shopify store's product list");
        break;
      }
      if (json.products.length === 0) break;
      ctx.found(json.products.length);
      ctx.log(`Read page ${page}: ${json.products.length} products`);
      for (const p of json.products) {
        if (count >= ctx.maxProducts) break;
        const mapped = mapShopifyProduct(p, origin, currency);
        if (mapped) {
          count++;
          yield mapped;
        }
      }
      if (json.products.length < 250) break;
    }
  },
};
