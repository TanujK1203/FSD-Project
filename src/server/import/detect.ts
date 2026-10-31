import { genericAdapter } from "./adapters/generic";
import { instagramAdapter } from "./adapters/instagram";
import { shopifyAdapter } from "./adapters/shopify";
import { wooAdapter } from "./adapters/woocommerce";
import { assertPublicUrl, parseJson, safeFetch, safeFetchRetry } from "./safeFetch";
import type { Adapter, AdapterName } from "./types";

export const ADAPTERS: Record<AdapterName, Adapter> = {
  shopify: shopifyAdapter,
  woocommerce: wooAdapter,
  generic: genericAdapter,
  instagram: instagramAdapter,
};

const SOCIAL_HOSTS = /(^|\.)(instagram\.com|instagr\.am|facebook\.com|fb\.me|wa\.me|whatsapp\.com|linktr\.ee|youtube\.com|threads\.net)$/i;

/** Turn what the seller typed into a URL ("mystore.in" -> "https://mystore.in/"). */
export function normalizeInputUrl(input: string): URL | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    u.hash = "";
    if (!u.hostname.includes(".")) return null;
    return u;
  } catch {
    return null;
  }
}

export type Detection =
  | { kind: "store"; adapter: AdapterName; url: URL }
  | { kind: "instagram"; handle: string | null }
  | { kind: "social"; host: string };

export async function detectStore(url: URL): Promise<Detection> {
  const host = url.hostname.toLowerCase();
  if (/(^|\.)(instagram\.com|instagr\.am)$/.test(host)) {
    const handle = url.pathname.split("/").filter(Boolean)[0] ?? null;
    return { kind: "instagram", handle };
  }
  if (SOCIAL_HOSTS.test(host)) return { kind: "social", host };

  await assertPublicUrl(url);
  const origin = url.origin;

  const isShopify = async () => {
    try {
      const res = await safeFetchRetry(`${origin}/products.json?limit=1`, { accept: "application/json", timeoutMs: 10000 }, 2);
      const json = parseJson<{ products?: unknown[] }>(res);
      return Boolean(json && Array.isArray(json.products));
    } catch {
      return false;
    }
  };
  if (await isShopify()) return { kind: "store", adapter: "shopify", url };

  // the JSON feed can be throttled; a Shopify theme is easy to spot in the page itself
  try {
    const home = await safeFetch(url, { timeoutMs: 10000 });
    if (/cdn\.shopify\.com|Shopify\.theme|myshopify\.com/.test(home.body.slice(0, 300_000))) {
      await new Promise((r) => setTimeout(r, 2000));
      if (await isShopify()) return { kind: "store", adapter: "shopify", url };
    }
  } catch {}

  try {
    const res = await safeFetchRetry(`${origin}/wp-json/wc/store/v1/products?per_page=1`, {
      accept: "application/json",
      timeoutMs: 10000,
    });
    const json = parseJson<unknown[]>(res);
    if (Array.isArray(json)) return { kind: "store", adapter: "woocommerce", url };
  } catch {}

  return { kind: "store", adapter: "generic", url };
}
