import { describe, expect, it } from "vitest";
import {
  extractJsonLd,
  extractMicrodata,
  extractOpenGraph,
  extractProducts,
  looksLikeProductUrl,
  parseSitemap,
  productLinks,
} from "@/server/import/extract";
import { mapShopifyProduct } from "@/server/import/adapters/shopify";
import { mapWooProduct } from "@/server/import/adapters/woocommerce";
import { parseCaptionHeuristic } from "@/server/import/caption";
import { productFromCaption } from "@/server/import/adapters/instagram";
import { parseRobots } from "@/server/import/robots";
import { guessCategory } from "@/lib/categories";

const page = (head: string, body = "") => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe("JSON-LD", () => {
  it("reads a plain Product with an Offer", () => {
    const html = page(`<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Block Print Kurta",
      description: "<p>Hand block printed cotton.</p>",
      image: ["/img/a.jpg", "https://cdn.x.com/b.jpg"],
      sku: "K-1",
      offers: { "@type": "Offer", price: "1299.00", priceCurrency: "INR", availability: "https://schema.org/InStock" },
    })}</script>`);
    const [p] = extractJsonLd(html, "https://shop.example.in/products/kurta");
    expect(p).toBeDefined();
    expect(p!.title).toBe("Block Print Kurta");
    expect(p!.description).toBe("Hand block printed cotton.");
    expect(p!.images.map((i) => i.url)).toEqual(["https://shop.example.in/img/a.jpg", "https://cdn.x.com/b.jpg"]);
    expect(p!.variants[0]).toMatchObject({ pricePaise: 129900, available: true });
    expect(p!.category).toBe("clothing");
    expect(p!.needsReview).toBeNull();
  });

  it("finds products inside @graph and handles AggregateOffer + out of stock", () => {
    const html = page(`<script type="application/ld+json">${JSON.stringify({
      "@graph": [
        { "@type": "WebSite", name: "x" },
        { "@type": ["Product"], name: "Silver Jhumka", image: { "@type": "ImageObject", url: "https://c.in/j.jpg" },
          offers: { "@type": "AggregateOffer", lowPrice: 799, highPrice: 999, priceCurrency: "INR", availability: "OutOfStock" } },
      ],
    })}</script>`);
    const [p] = extractJsonLd(html, "https://c.in/p/jhumka");
    expect(p!.variants[0]).toMatchObject({ pricePaise: 79900, available: false });
    expect(p!.images[0]!.url).toBe("https://c.in/j.jpg");
    expect(p!.category).toBe("jewellery");
  });

  it("expands ProductGroup variants", () => {
    const html = page(`<script type="application/ld+json">${JSON.stringify({
      "@type": "ProductGroup",
      name: "Linen Shirt",
      hasVariant: [
        { "@type": "Product", sku: "S1", size: "S", offers: { price: 1500, priceCurrency: "INR" } },
        { "@type": "Product", sku: "M1", size: "M", offers: { price: 1600, priceCurrency: "INR", availability: "OutOfStock" } },
      ],
    })}</script>`);
    const [p] = extractJsonLd(html, "https://x.in/products/linen");
    expect(p!.variants.map((v) => [v.name, v.pricePaise, v.available])).toEqual([
      ["S", 150000, true],
      ["M", 160000, false],
    ]);
  });

  it("flags foreign currency and ignores products with no price", () => {
    const usd = page(`<script type="application/ld+json">{"@type":"Product","name":"Mug","offers":{"price":"20","priceCurrency":"USD"}}</script>`);
    expect(extractJsonLd(usd, "https://x.com/p/mug")[0]!.needsReview).toBe("Prices are in USD");
    const none = page(`<script type="application/ld+json">{"@type":"Product","name":"Mug"}</script>`);
    expect(extractJsonLd(none, "https://x.com/p/mug")).toEqual([]);
  });

  it("survives trailing commas", () => {
    const html = page(`<script type="application/ld+json">{"@type":"Product","name":"Candle","offers":{"price":"450",},}</script>`);
    expect(extractJsonLd(html, "https://x.in/p/c")[0]!.variants[0]!.pricePaise).toBe(45000);
  });
});

describe("microdata and OpenGraph fallbacks", () => {
  it("reads microdata", () => {
    const html = page("", `<div itemscope itemtype="https://schema.org/Product"><h1 itemprop="name">Tote Bag</h1>
      <img itemprop="image" src="/t.jpg"><meta itemprop="price" content="650"><meta itemprop="priceCurrency" content="INR"></div>`);
    const p = extractMicrodata(html, "https://x.in/products/tote");
    expect(p).toMatchObject({ title: "Tote Bag", category: "bags" });
    expect(p!.variants[0]!.pricePaise).toBe(65000);
    expect(p!.images[0]!.url).toBe("https://x.in/t.jpg");
  });
  it("reads OpenGraph product tags", () => {
    const html = page(`<meta property="og:title" content="Mango Pickle 500g"><meta property="og:image" content="https://x.in/a.jpg">
      <meta property="product:price:amount" content="349"><meta property="product:price:currency" content="INR">`);
    const p = extractOpenGraph(html, "https://x.in/p/pickle");
    expect(p).toMatchObject({ title: "Mango Pickle 500g", category: "food" });
    expect(p!.variants[0]!.pricePaise).toBe(34900);
  });
  it("prefers JSON-LD and returns nothing for plain pages", () => {
    expect(extractProducts(page("<title>About us</title>"), "https://x.in/about")).toEqual([]);
  });
});

describe("discovery", () => {
  it("parses sitemaps and index files", () => {
    const idx = parseSitemap(`<?xml version="1.0"?><sitemapindex><sitemap><loc>https://x.in/sitemap_products_1.xml</loc></sitemap></sitemapindex>`);
    expect(idx.sitemaps).toEqual(["https://x.in/sitemap_products_1.xml"]);
    const set = parseSitemap(`<urlset><url><loc>https://x.in/products/a</loc></url><url><loc>https://x.in/pages/about</loc></url></urlset>`);
    expect(set.urls).toHaveLength(2);
  });
  it("recognises product URLs and same-site links", () => {
    expect(looksLikeProductUrl("https://x.in/products/kurta-blue")).toBe(true);
    expect(looksLikeProductUrl("https://x.in/p/123")).toBe(true);
    expect(looksLikeProductUrl("https://x.in/collections/all")).toBe(false);
    const links = productLinks(
      `<a href="/products/a">a</a><a href="https://other.com/products/b">b</a><a href="/products/a#x">dup</a><a href="/blog">blog</a>`,
      "https://www.x.in/",
    );
    expect(links).toEqual(["https://www.x.in/products/a"]);
  });
  it("respects robots.txt with longest match", () => {
    const r = parseRobots("User-agent: *\nDisallow: /checkout\nDisallow: /products/*?variant=\nAllow: /products/\nSitemap: https://x.in/sitemap.xml");
    expect(r.allows("/products/kurta")).toBe(true);
    expect(r.allows("/checkout/1")).toBe(false);
    expect(r.sitemaps).toEqual(["https://x.in/sitemap.xml"]);
  });
});

describe("platform adapters", () => {
  it("maps a Shopify product with options", () => {
    const p = mapShopifyProduct(
      {
        id: 1,
        title: "Chanderi Saree",
        handle: "chanderi-saree",
        body_html: "<p>Soft <b>chanderi</b> silk.</p>",
        product_type: "Saree",
        tags: ["handloom", "silk"],
        options: [{ name: "Colour" }],
        variants: [
          { id: 11, title: "Red", price: "4500.00", compare_at_price: "5000.00", available: true, option1: "Red" },
          { id: 12, title: "Blue", price: "4500.00", compare_at_price: null, available: false, option1: "Blue" },
        ],
        images: [{ src: "//cdn.shopify.com/a.jpg", position: 2 }, { src: "https://cdn.shopify.com/b.jpg", position: 1 }],
      },
      "https://shop.in",
      "INR",
    )!;
    expect(p.sourceId).toBe("shopify:1");
    expect(p.sourceUrl).toBe("https://shop.in/products/chanderi-saree");
    expect(p.description).toBe("Soft chanderi silk.");
    expect(p.images.map((i) => i.url)).toEqual(["https://cdn.shopify.com/b.jpg", "https://cdn.shopify.com/a.jpg"]);
    expect(p.variants[0]).toMatchObject({ name: "Red", options: { Colour: "Red" }, pricePaise: 450000, compareAtPaise: 500000 });
    expect(p.variants[1]!.available).toBe(false);
    expect(p.category).toBe("clothing");
  });
  it("collapses Shopify Default Title", () => {
    const p = mapShopifyProduct(
      { id: 2, title: "Soy Candle", handle: "c", body_html: null, tags: "", options: [{ name: "Title" }],
        variants: [{ id: 21, title: "Default Title", price: "450", compare_at_price: null, option1: "Default Title" }], images: [] },
      "https://x.in",
      "USD",
    )!;
    expect(p.variants[0]).toMatchObject({ name: "Default", options: {} });
    expect(p.needsReview).toBe("Prices are in USD");
  });
  it("maps a WooCommerce product with minor units", () => {
    const p = mapWooProduct({
      id: 7, name: "Macram&eacute; Wall Hanging", slug: "m", permalink: "https://w.in/product/m",
      description: "<p>Cotton cord.</p>",
      prices: { price: "89900", regular_price: "119900", sale_price: "89900", currency_code: "INR", currency_minor_unit: 2 },
      images: [{ src: "https://w.in/m.jpg", alt: "" }],
      categories: [{ name: "Wall decor" }],
      is_in_stock: true,
    })!;
    expect(p.variants[0]).toMatchObject({ pricePaise: 89900, compareAtPaise: 119900 });
    expect(p.sourceId).toBe("woo:7");
    expect(p.title).toBe("Macramé Wall Hanging");
    expect(p.category).toBe("home");
  });
});

describe("Instagram captions (rule-based)", () => {
  it("reads price, MRP and sizes", () => {
    const c = parseCaptionHeuristic(
      "Mulmul cotton kurta set 🌸\nPrice: ₹1,450\nMRP 1,899\nSizes: S, M, L, XL\nDM to order #handmade #kurti",
    );
    expect(c).toMatchObject({ isProduct: true, title: "Mulmul cotton kurta set", pricePaise: 145000, compareAtPaise: 189900 });
    expect(c.options[0]).toEqual({ name: "Size", values: ["S", "M", "L", "XL"] });
  });
  it("reads /- prices and skips posts with no price", () => {
    expect(parseCaptionHeuristic("Resin coaster set of 4\n799/- only").pricePaise).toBe(79900);
    expect(parseCaptionHeuristic("Thank you for 10k followers! ❤️").isProduct).toBe(false);
    expect(parseCaptionHeuristic("New drop. DM for price").isProduct).toBe(false);
  });
  it("builds a product with one variant per size", () => {
    const parsed = parseCaptionHeuristic("Linen shirt\nRs 1200\nSizes M/L");
    const p = productFromCaption(
      { id: "9", media_type: "CAROUSEL_ALBUM", permalink: "https://instagram.com/p/x", children: { data: [{ media_type: "IMAGE", media_url: "https://cdn/a.jpg" }] } },
      parsed,
    )!;
    expect(p.variants.map((v) => v.name)).toEqual(["M", "L"]);
    expect(p.images).toEqual([{ url: "https://cdn/a.jpg" }]);
    expect(p.sourceId).toBe("ig:9");
  });
});

describe("categories", () => {
  it("matches word starts only", () => {
    expect(guessCategory("Oxidised earrings")).toBe("jewellery");
    expect(guessCategory("Laptop sleeve")).not.toBe("clothing");
    expect(guessCategory("Something unusual")).toBe("other");
  });
});

import { htmlToText } from "@/lib/text";
describe("htmlToText", () => {
  it("keeps lists on one line each and drops blank runs", () => {
    expect(htmlToText("<p>Details</p><p></p><ul><li><p>Base: wire</p></li><li>Handle &amp; strap</li></ul><p>Wash&nbsp;gently</p>")).toBe(
      "Details\n• Base: wire\n• Handle & strap\nWash gently",
    );
  });
});
