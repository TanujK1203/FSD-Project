import * as cheerio from "cheerio";
import { sniff } from "../media";
import { parseJson, safeFetch, safeFetchBuffer } from "./safeFetch";

/**
 * Logo candidates for a store website, best first: the logo the site declares for Google
 * (Organization JSON-LD), then its app icon (apple-touch-icon, a square image most stores set),
 * then large favicons. Banners (og:image) are skipped because they crop badly into a circle.
 */
export function logoCandidates(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const found: string[] = [];
  const add = (href: string | undefined) => {
    if (!href) return;
    try {
      const abs = new URL(href.trim(), pageUrl);
      if ((abs.protocol === "https:" || abs.protocol === "http:") && !/\.(svg|ico)(\?|$)/i.test(abs.pathname)) {
        found.push(abs.href);
      }
    } catch {}
  };

  $('script[type="application/ld+json"]').each((_, el) => {
    let data: unknown;
    try {
      data = JSON.parse($(el).text());
    } catch {
      return;
    }
    const nodes: unknown[] = [];
    const walk = (n: unknown) => {
      if (Array.isArray(n)) n.forEach(walk);
      else if (n && typeof n === "object") {
        nodes.push(n);
        const graph = (n as { "@graph"?: unknown })["@graph"];
        if (graph) walk(graph);
      }
    };
    walk(data);
    for (const n of nodes) {
      const node = n as { "@type"?: string | string[]; logo?: unknown };
      const types = ([] as string[]).concat(node["@type"] ?? []);
      if (!types.some((t) => /Organization|Store|Brand/i.test(t))) continue;
      const logo = node.logo;
      add(typeof logo === "string" ? logo : (logo as { url?: string } | undefined)?.url);
    }
  });

  $('link[rel~="apple-touch-icon"], link[rel~="apple-touch-icon-precomposed"]').each((_, el) => add($(el).attr("href")));

  const icons = $('link[rel~="icon"]')
    .toArray()
    .map((el) => ({ href: $(el).attr("href"), size: Number(($(el).attr("sizes") ?? "").split("x")[0]) || 0 }));
  for (const i of icons.filter((i) => i.size >= 96).sort((a, b) => b.size - a.size)) add(i.href);
  // icons without a declared size come last; their real size is checked after download
  for (const i of icons.filter((i) => i.size === 0)) add(i.href);

  return [...new Set(found)];
}

/** Width of a PNG from its header, or null for other formats. */
function pngWidth(buf: Buffer): number | null {
  return buf.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" && buf.length >= 24 ? buf.readUInt32BE(16) : null;
}

const MIN_LOGO_PX = 64;

/** The first logo on the site that downloads as a real image. Linked like product photos, not copied. */
export async function findSiteLogo(origin: string): Promise<string | null> {
  const res = await safeFetch(origin, { timeoutMs: 10000 });
  if (res.status !== 200) return null;
  for (const src of logoCandidates(res.body, res.url)) {
    try {
      const { buffer } = await safeFetchBuffer(src, 2 * 1024 * 1024);
      // tiny favicons look blurry in the store circle
      if (sniff(buffer) && (pngWidth(buffer) ?? MIN_LOGO_PX) >= MIN_LOGO_PX) return src;
    } catch {}
  }
  return null;
}

export async function findInstagramPicture(accessToken: string): Promise<string | null> {
  const res = await safeFetch(
    `https://graph.instagram.com/me?fields=profile_picture_url&access_token=${encodeURIComponent(accessToken)}`,
    { accept: "application/json" },
  );
  return parseJson<{ profile_picture_url?: string }>(res)?.profile_picture_url ?? null;
}
