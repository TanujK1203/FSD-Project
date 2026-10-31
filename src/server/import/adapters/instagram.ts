import { guessCategory } from "@/lib/categories";
import { IMPORT } from "@/config";
import { parseCaptionHeuristic } from "../caption";
import { parseJson, safeFetch } from "../safeFetch";
import type { Adapter, CaptionParse, ImportedProduct } from "../types";

type IgMedia = {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  children?: { data: { media_url?: string; media_type: string; thumbnail_url?: string }[] };
};

const FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_url,media_type,thumbnail_url}";

function imagesOf(m: IgMedia): string[] {
  if (m.media_type === "CAROUSEL_ALBUM" && m.children?.data?.length) {
    return m.children.data
      .map((c) => (c.media_type === "VIDEO" ? c.thumbnail_url : c.media_url))
      .filter((u): u is string => Boolean(u))
      .slice(0, 8);
  }
  const u = m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url;
  return u ? [u] : [];
}

export function productFromCaption(m: IgMedia, parsed: CaptionParse): ImportedProduct | null {
  if (!parsed.isProduct) return null;
  const images = imagesOf(m);
  if (!images.length) return null;
  const sizes = parsed.options.find((o) => o.values.length);
  const price = parsed.pricePaise ?? 0;
  const variants = sizes
    ? sizes.values.map((v) => ({
        name: v,
        options: { [sizes.name]: v },
        pricePaise: price,
        compareAtPaise: parsed.compareAtPaise,
        available: true,
        sourceId: v,
      }))
    : [{ name: "Default", options: {}, pricePaise: price, compareAtPaise: parsed.compareAtPaise, available: true, sourceId: "default" }];
  return {
    sourceId: `ig:${m.id}`,
    sourceUrl: m.permalink ?? null,
    title: parsed.title,
    description: parsed.description,
    category: parsed.category ?? guessCategory(parsed.title, parsed.description),
    tags: [],
    images: images.map((url) => ({ url })),
    variants,
    currency: "INR",
    needsReview: parsed.pricePaise === null ? "Price missing" : "From an Instagram post, check details",
  };
}

export const instagramAdapter: Adapter = {
  name: "instagram",
  complete: false,
  async *run(_url, ctx) {
    if (!ctx.instagram?.accessToken) throw new Error("Instagram is not connected for this store");
    let next: string | null =
      `https://graph.instagram.com/me/media?fields=${encodeURIComponent(FIELDS)}&limit=50&access_token=${encodeURIComponent(ctx.instagram.accessToken)}`;
    let seen = 0;
    let produced = 0;
    let skipped = 0;
    while (next && seen < IMPORT.instagramMaxPosts && produced < ctx.maxProducts) {
      const res = await safeFetch(next, { accept: "application/json" });
      const json = parseJson<{ data?: IgMedia[]; paging?: { next?: string }; error?: { message: string } }>(res);
      if (!json?.data) {
        const err = (() => {
          try {
            return (JSON.parse(res.body) as { error?: { message?: string } }).error?.message;
          } catch {
            return null;
          }
        })();
        throw new Error(err ? `Instagram said: ${err}` : "Could not read posts from Instagram");
      }
      ctx.found(json.data.length);
      for (const m of json.data) {
        seen++;
        if (!m.caption) {
          skipped++;
          continue;
        }
        const parsed = (ctx.llm ? await ctx.llm.parseCaption(m.caption) : null) ?? parseCaptionHeuristic(m.caption);
        const product = productFromCaption(m, parsed);
        if (!product) {
          skipped++;
          continue;
        }
        produced++;
        yield product;
      }
      next = json.paging?.next ?? null;
    }
    ctx.log(`Read ${seen} posts. ${produced} look like products, ${skipped} skipped.`);
    if (!ctx.llm && skipped) ctx.log("Posts without a clear price were skipped. Turn on the AI reader to catch more.", "info");
  },
};
