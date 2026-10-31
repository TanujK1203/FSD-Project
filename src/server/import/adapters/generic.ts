import { IMPORT } from "@/config";
import { guessCategory } from "@/lib/categories";
import {
  canonicalKey,
  extractProducts,
  listingLinks,
  looksLikeProductUrl,
  pageDigest,
  parseSitemap,
  productLinks,
  sameSite,
} from "../extract";
import { renderPage } from "../render";
import { loadRobots, type Robots } from "../robots";
import { mapLimit, safeFetch } from "../safeFetch";
import type { Adapter, ImportContext, ImportedProduct } from "../types";

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await safeFetch(url);
    if (res.status !== 200) return null;
    if (res.contentType && !/html|xml|text/i.test(res.contentType)) return null;
    return res.body;
  } catch {
    return null;
  }
}

/** A page with almost no text but a JS app root probably needs a real browser. */
function looksClientRendered(html: string): boolean {
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return bodyText.length < 400 || /id="(__next|root|app|__nuxt)"/.test(html) && bodyText.length < 1500;
}

async function discoverFromSitemaps(origin: string, robots: Robots, ctx: ImportContext): Promise<string[]> {
  const queue = [...robots.sitemaps];
  for (const p of ["/sitemap.xml", "/sitemap_index.xml", "/product-sitemap.xml", "/sitemap_products_1.xml"]) {
    if (!queue.some((q) => q.endsWith(p))) queue.push(origin + p);
  }
  const seen = new Set<string>();
  const productUrls = new Set<string>();
  let fetched = 0;
  while (queue.length && fetched < 15 && productUrls.size < IMPORT.maxPagesGeneric) {
    // product sitemaps first
    queue.sort((a, b) => Number(/product/i.test(b)) - Number(/product/i.test(a)));
    const sm = queue.shift()!;
    if (seen.has(sm)) continue;
    seen.add(sm);
    try {
      if (!sameSite(sm, origin)) continue;
      const res = await safeFetch(sm, { accept: "application/xml,text/xml,*/*" });
      fetched++;
      if (res.status !== 200 || !/<(urlset|sitemapindex)/i.test(res.body.slice(0, 2000))) continue;
      const { sitemaps, urls } = parseSitemap(res.body);
      queue.push(...sitemaps.filter((s) => !seen.has(s)));
      const isProductSitemap = /product/i.test(sm);
      let added = 0;
      for (const u of urls) {
        if (!sameSite(u, origin)) continue;
        if (isProductSitemap || looksLikeProductUrl(u)) {
          productUrls.add(u);
          added++;
        }
      }
      if (added) ctx.log(`Sitemap ${new URL(sm).pathname}: ${added} product pages`);
    } catch {
      // ignore broken sitemaps
    }
  }
  return [...productUrls];
}

async function discoverFromPages(startUrl: string, homeHtml: string | null, ctx: ImportContext): Promise<string[]> {
  const found = new Set<string>();
  let html = homeHtml;
  if (html && looksClientRendered(html)) {
    ctx.log("Site loads with JavaScript, opening it in a browser");
    html = (await renderPage(startUrl)) ?? html;
  }
  if (!html) return [];
  for (const u of productLinks(html, startUrl)) found.add(u);
  const listings = listingLinks(html, startUrl);
  await mapLimit(listings, IMPORT.concurrency, async (l) => {
    let lh = await fetchHtml(l);
    if (lh && looksClientRendered(lh)) lh = (await renderPage(l)) ?? lh;
    if (lh) for (const u of productLinks(lh, l)) found.add(u);
  });
  if (found.size) ctx.log(`Found ${found.size} product links on the site's pages`);
  return [...found];
}

type SiteState = { llm: number; staticHits: number; renderHelps: number; renderMisses: number };

/** Decide per site whether a browser render is worth it: try it on early misses, stop if it never helps. */
function shouldRender(html: string | null, site: SiteState) {
  if (!html || looksClientRendered(html)) return true;
  if (site.renderHelps > 0) return true;
  return site.renderMisses < 3;
}

async function extractWithFallbacks(url: string, ctx: ImportContext, site: SiteState): Promise<ImportedProduct[]> {
  let html = await fetchHtml(url);
  if (html) {
    const direct = extractProducts(html, url);
    if (direct.length) {
      site.staticHits++;
      return direct;
    }
  }
  // structured data may only appear after JavaScript runs
  if (shouldRender(html, site)) {
    const rendered = await renderPage(url, { waitForProductData: true });
    if (rendered) {
      html = rendered;
      const fromRendered = extractProducts(rendered, url);
      if (fromRendered.length) {
        site.renderHelps++;
        return fromRendered;
      }
    }
    site.renderMisses++;
  }
  if (!html || !ctx.llm || site.llm <= 0) return [];
  site.llm--;
  const digest = pageDigest(html, url);
  const ai = await ctx.llm.extractFromPage({ url, ...digest }).catch(() => null);
  if (!ai || !ai.isProductPage || !ai.title) return [];
  const optionValues = ai.options.filter((o) => o.values.length);
  const variants =
    optionValues.length === 1
      ? optionValues[0]!.values.map((v) => ({
          name: v,
          options: { [optionValues[0]!.name]: v },
          pricePaise: ai.pricePaise ?? 0,
          compareAtPaise: ai.compareAtPaise,
          available: ai.inStock,
        }))
      : [{ name: "Default", options: {}, pricePaise: ai.pricePaise ?? 0, compareAtPaise: ai.compareAtPaise, available: ai.inStock }];
  return [
    {
      sourceId: `web:${canonicalKey(url)}`,
      sourceUrl: url,
      title: ai.title,
      description: ai.description,
      category: guessCategory(ai.title, ai.description.slice(0, 200)),
      tags: [],
      images: ai.images.map((u) => ({ url: u })),
      variants,
      currency: ai.currency,
      needsReview:
        ai.pricePaise === null
          ? "Price missing"
          : ai.currency && ai.currency !== "INR"
            ? `Prices are in ${ai.currency}`
            : "Read by AI, check details",
    },
  ];
}

export const genericAdapter: Adapter = {
  name: "generic",
  complete: false,
  async *run(url, ctx) {
    const origin = url.origin;
    const robots = await loadRobots(origin);
    const start = url.toString();
    const homeHtml = await fetchHtml(start);

    // the pasted link may itself be a product page
    const seen = new Set<string>();
    let count = 0;
    if (homeHtml) {
      for (const p of extractProducts(homeHtml, start)) {
        if (seen.has(p.sourceId)) continue;
        seen.add(p.sourceId);
        count++;
        yield p;
      }
    }

    let urls = await discoverFromSitemaps(origin, robots, ctx);
    if (!urls.length) urls = await discoverFromPages(start, homeHtml, ctx);
    const allowed = urls.filter((u) => robots.allows(new URL(u).pathname));
    if (allowed.length < urls.length) ctx.log(`Skipped ${urls.length - allowed.length} pages the site asks crawlers not to visit`);
    const targets = allowed.filter((u) => !seen.has(`web:${canonicalKey(u)}`)).slice(0, IMPORT.maxPagesGeneric);
    if (!targets.length && count === 0) {
      throw new Error("Could not find product pages on this site. Try pasting a link to one product or your shop page.");
    }
    ctx.found(targets.length + count);
    ctx.log(`Checking ${targets.length} product pages`);

    const site: SiteState = { llm: IMPORT.maxLlmPages, staticHits: 0, renderHelps: 0, renderMisses: 0 };
    let missing = 0;
    // process in small batches so products appear progressively
    for (let i = 0; i < targets.length && count < ctx.maxProducts; i += IMPORT.concurrency * 2) {
      const batch = targets.slice(i, i + IMPORT.concurrency * 2);
      const results = await mapLimit(batch, IMPORT.concurrency, (u) => extractWithFallbacks(u, ctx, site));
      for (const list of results) {
        if (!list.length) missing++;
        for (const p of list) {
          if (seen.has(p.sourceId) || count >= ctx.maxProducts) continue;
          seen.add(p.sourceId);
          count++;
          yield p;
        }
      }
    }
    if (missing) {
      ctx.log(
        `${missing} pages had no readable product details${ctx.llm ? "" : " (AI fallback is off)"}`,
        missing > targets.length / 2 ? "warn" : "info",
      );
    }
  },
};
