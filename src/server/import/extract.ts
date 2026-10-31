import * as cheerio from "cheerio";
import { guessCategory } from "@/lib/categories";
import { rupeesToPaise } from "@/lib/money";
import { htmlToText } from "@/lib/text";
import type { ImportedProduct, ImportedVariant } from "./types";

type Json = Record<string, unknown>;

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function typeOf(node: Json): string[] {
  return asArray(node["@type"] as string | string[]).map((t) => String(t).replace(/^https?:\/\/schema\.org\//, ""));
}

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object" && "@value" in (v as Json)) return String((v as Json)["@value"]);
  return "";
}

/** Walk any JSON-LD shape (arrays, @graph, nested) and collect Product / ProductGroup nodes. */
function collectProducts(node: unknown, out: Json[], depth = 0) {
  if (!node || depth > 6) return;
  if (Array.isArray(node)) {
    for (const n of node) collectProducts(n, out, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Json;
  const types = typeOf(obj);
  if (types.includes("Product") || types.includes("ProductGroup")) {
    out.push(obj);
    return;
  }
  if (obj["@graph"]) collectProducts(obj["@graph"], out, depth + 1);
  if (obj.mainEntity) collectProducts(obj.mainEntity, out, depth + 1);
  if (obj.itemListElement) {
    for (const el of asArray(obj.itemListElement as unknown[])) {
      const item = (el as Json)?.item ?? el;
      collectProducts(item, out, depth + 1);
    }
  }
}

function imageUrls(v: unknown, base: string): string[] {
  const out: string[] = [];
  for (const item of asArray(v as unknown[])) {
    let u = "";
    if (typeof item === "string") u = item;
    else if (item && typeof item === "object") u = str((item as Json).url) || str((item as Json).contentUrl);
    if (!u) continue;
    try {
      out.push(new URL(u, base).toString());
    } catch {}
  }
  return [...new Set(out)];
}

type OfferInfo = { price: number | null; compareAt: number | null; currency: string | null; available: boolean; sku: string | null };

function readOffers(offers: unknown): OfferInfo {
  const list = asArray(offers as unknown[]).filter((o) => o && typeof o === "object") as Json[];
  let best: OfferInfo = { price: null, compareAt: null, currency: null, available: true, sku: null };
  for (const o of list) {
    const spec = asArray(o.priceSpecification as Json[])[0] as Json | undefined;
    const priceRaw = str(o.price) || str(o.lowPrice) || (spec ? str(spec.price) : "");
    const price = rupeesToPaise(priceRaw || null);
    const highRaw = str(o.highPrice);
    const currency = str(o.priceCurrency) || (spec ? str(spec.priceCurrency) : "") || null;
    const availability = str(o.availability);
    const available = !/OutOfStock|SoldOut|Discontinued/i.test(availability);
    if (price !== null && (best.price === null || price < best.price)) {
      best = {
        price,
        compareAt: null,
        currency,
        available,
        sku: str(o.sku) || null,
      };
      // AggregateOffer highPrice is a range, not a "was" price; ignore it for compare-at
      void highRaw;
    }
  }
  return best;
}

function fromJsonLdNode(node: Json, pageUrl: string): ImportedProduct | null {
  const types = typeOf(node);
  const title = htmlToText(str(node.name));
  if (!title) return null;
  const images = imageUrls(node.image, pageUrl);
  const description = htmlToText(str(node.description));
  let variants: ImportedVariant[] = [];
  let currency: string | null = null;

  if (types.includes("ProductGroup") && node.hasVariant) {
    for (const v of asArray(node.hasVariant as Json[])) {
      if (!v || typeof v !== "object") continue;
      const offer = readOffers(v.offers);
      if (offer.price === null) continue;
      currency = currency ?? offer.currency;
      const options: Record<string, string> = {};
      for (const key of ["size", "color", "colour", "material", "pattern"]) {
        const val = str((v as Json)[key]);
        if (val) options[key[0]!.toUpperCase() + key.slice(1)] = val;
      }
      const name = Object.values(options).join(" / ") || htmlToText(str(v.name)).replace(title, "").trim() || "Default";
      variants.push({
        sourceId: str(v.sku) || str(v["@id"]) || name,
        name,
        options,
        pricePaise: offer.price,
        compareAtPaise: offer.compareAt,
        available: offer.available,
        sku: str(v.sku) || null,
      });
      images.push(...imageUrls(v.image, pageUrl).filter((u) => !images.includes(u)));
    }
  }

  if (!variants.length) {
    const offer = readOffers(node.offers);
    if (offer.price === null) return null;
    currency = offer.currency;
    variants = [
      {
        sourceId: str(node.sku) || null,
        name: "Default",
        options: {},
        pricePaise: offer.price,
        compareAtPaise: offer.compareAt,
        available: offer.available,
        sku: str(node.sku) || offer.sku,
      },
    ];
  }

  const category = str(node.category);
  return {
    sourceId: `web:${canonicalKey(str(node.url) || pageUrl)}`,
    sourceUrl: str(node.url) ? new URL(str(node.url), pageUrl).toString() : pageUrl,
    title,
    description,
    category: guessCategory(category, title, description.slice(0, 200)),
    tags: category ? [category] : [],
    images: images.slice(0, 10).map((url) => ({ url })),
    variants,
    currency,
    needsReview: currency && currency !== "INR" ? `Prices are in ${currency}` : null,
  };
}

export function canonicalKey(u: string): string {
  try {
    const url = new URL(u);
    return (url.hostname.replace(/^www\./, "") + url.pathname.replace(/\/+$/, "")).toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}

export function extractJsonLd(html: string, pageUrl: string): ImportedProduct[] {
  const $ = cheerio.load(html);
  const nodes: Json[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    try {
      collectProducts(JSON.parse(raw), nodes);
    } catch {
      // some sites put several JSON objects or trailing commas in one tag; try a light repair
      try {
        collectProducts(JSON.parse(raw.replace(/,\s*([}\]])/g, "$1")), nodes);
      } catch {}
    }
  });
  const out: ImportedProduct[] = [];
  for (const n of nodes) {
    const p = fromJsonLdNode(n, pageUrl);
    if (p) out.push(p);
  }
  return out;
}

export function extractMicrodata(html: string, pageUrl: string): ImportedProduct | null {
  const $ = cheerio.load(html);
  const scope = $('[itemtype*="schema.org/Product"]').first();
  if (!scope.length) return null;
  const prop = (name: string) => {
    const el = scope.find(`[itemprop="${name}"]`).first();
    if (!el.length) return "";
    return (el.attr("content") || el.attr("src") || el.attr("href") || el.text()).trim();
  };
  const title = htmlToText(prop("name"));
  const price = rupeesToPaise(prop("price") || prop("lowPrice") || null);
  if (!title || price === null) return null;
  const imgs: string[] = [];
  scope.find('[itemprop="image"]').each((_, el) => {
    const u = $(el).attr("content") || $(el).attr("src") || $(el).attr("href");
    if (u) {
      try {
        imgs.push(new URL(u, pageUrl).toString());
      } catch {}
    }
  });
  const currency = prop("priceCurrency") || null;
  const description = htmlToText(prop("description"));
  return {
    sourceId: `web:${canonicalKey(pageUrl)}`,
    sourceUrl: pageUrl,
    title,
    description,
    category: guessCategory(title, description.slice(0, 200)),
    tags: [],
    images: [...new Set(imgs)].map((url) => ({ url })),
    variants: [
      {
        name: "Default",
        options: {},
        pricePaise: price,
        available: !/OutOfStock/i.test(prop("availability")),
      },
    ],
    currency,
    needsReview: currency && currency !== "INR" ? `Prices are in ${currency}` : null,
  };
}

export function extractOpenGraph(html: string, pageUrl: string): ImportedProduct | null {
  const $ = cheerio.load(html);
  const meta = (p: string) =>
    $(`meta[property="${p}"]`).attr("content")?.trim() || $(`meta[name="${p}"]`).attr("content")?.trim() || "";
  const priceRaw = meta("product:price:amount") || meta("og:price:amount") || meta("product:sale_price:amount");
  const title = htmlToText(meta("og:title"));
  const price = rupeesToPaise(priceRaw || null);
  if (!title || price === null) return null;
  const images: string[] = [];
  $('meta[property="og:image"], meta[property="og:image:secure_url"]').each((_, el) => {
    const u = $(el).attr("content");
    if (u) {
      try {
        images.push(new URL(u, pageUrl).toString());
      } catch {}
    }
  });
  const currency = meta("product:price:currency") || meta("og:price:currency") || null;
  const description = htmlToText(meta("og:description"));
  const availability = meta("product:availability") || meta("og:availability");
  return {
    sourceId: `web:${canonicalKey(meta("og:url") || pageUrl)}`,
    sourceUrl: pageUrl,
    title,
    description,
    category: guessCategory(title, description.slice(0, 200)),
    tags: [],
    images: [...new Set(images)].map((url) => ({ url })),
    variants: [
      { name: "Default", options: {}, pricePaise: price, available: !/out of stock|oos|sold/i.test(availability) },
    ],
    currency,
    needsReview: currency && currency !== "INR" ? `Prices are in ${currency}` : null,
  };
}

/** Try every structured-data source on a page, best first. */
export function extractProducts(html: string, pageUrl: string): ImportedProduct[] {
  const ld = extractJsonLd(html, pageUrl);
  if (ld.length) return ld;
  const md = extractMicrodata(html, pageUrl);
  if (md) return [md];
  const og = extractOpenGraph(html, pageUrl);
  return og ? [og] : [];
}

/** Visible text and candidate product images, for the AI fallback. */
export function pageDigest(html: string, pageUrl: string) {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, header nav, footer").remove();
  const title = $("title").text().trim();
  const text = `${title}\n${$("body").text()}`.replace(/\s+/g, " ").trim().slice(0, 12000);
  const images: string[] = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-original") || "";
    if (!src || src.startsWith("data:") || /logo|icon|sprite|badge|payment/i.test(src)) return;
    try {
      images.push(new URL(src, pageUrl).toString());
    } catch {}
  });
  const og = $('meta[property="og:image"]').attr("content");
  if (og) {
    try {
      images.unshift(new URL(og, pageUrl).toString());
    } catch {}
  }
  return { text, images: [...new Set(images)].slice(0, 12) };
}

const PRODUCT_PATH = /\/(products?|p|item|items|shop|store|buy|dp)\/[^/?#]+/i;

export function looksLikeProductUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return PRODUCT_PATH.test(url.pathname) && !/\/(collections?|categor(y|ies)|tag|cart|account|blog|pages?)\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function sameSite(a: string, b: string): boolean {
  try {
    return new URL(a).hostname.replace(/^www\./, "") === new URL(b).hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
}

/** Collect links from a page that look like product pages on the same site. */
export function productLinks(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      const abs = new URL(href, pageUrl);
      abs.hash = "";
      abs.search = "";
      const s = abs.toString();
      if (sameSite(s, pageUrl) && looksLikeProductUrl(s)) out.add(s);
    } catch {}
  });
  return [...out];
}

/** Collection/category pages worth scanning for product links. */
export function listingLinks(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, pageUrl);
      abs.hash = "";
      if (sameSite(abs.toString(), pageUrl) && /\/(collections?|categor(y|ies)|shop|catalog|store|all)(\/|$)/i.test(abs.pathname)) {
        out.add(abs.toString());
      }
    } catch {}
  });
  return [...out].slice(0, 8);
}

export function parseSitemap(xml: string): { sitemaps: string[]; urls: string[] } {
  const $ = cheerio.load(xml, { xml: true });
  const sitemaps: string[] = [];
  const urls: string[] = [];
  $("sitemap > loc").each((_, el) => {
    sitemaps.push($(el).text().trim());
  });
  $("url > loc").each((_, el) => {
    urls.push($(el).text().trim());
  });
  return { sitemaps, urls };
}
