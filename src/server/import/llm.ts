import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { rupeesToPaise } from "@/lib/money";
import type { CaptionParse, LlmExtractor, PageExtract } from "./types";

// Override with IMPORT_AI_MODEL (e.g. claude-haiku-5-5) to trade some accuracy for lower cost.
const MODEL = process.env.IMPORT_AI_MODEL || "claude-opus-5-5";

const OptionSchema = z.object({
  name: z.string().describe("Option name such as Size or Colour"),
  values: z.array(z.string()),
});

const PageSchema = z.object({
  is_product_page: z.boolean().describe("true only if the page sells one specific product"),
  title: z.string(),
  description: z.string().describe("Short plain-text description, at most 600 characters"),
  price: z.number().nullable().describe("Current selling price as a number in the page currency, null if not shown"),
  compare_at_price: z.number().nullable().describe("Original price before discount if a discount is shown, else null"),
  currency: z.string().nullable().describe("ISO currency code such as INR"),
  image_urls: z.array(z.string()).describe("Product photo URLs chosen from the candidate list, best first"),
  options: z.array(OptionSchema),
  in_stock: z.boolean(),
});

const CaptionSchema = z.object({
  is_product: z.boolean().describe("true if the post offers an item for sale"),
  title: z.string().describe("Short product name, under 80 characters, no hashtags or emojis"),
  description: z.string().describe("Plain-text product details from the caption, no hashtags, at most 600 characters"),
  price_inr: z.number().nullable().describe("Selling price in rupees, null if not stated"),
  compare_at_price_inr: z.number().nullable().describe("Original price in rupees if a discount is stated, else null"),
  options: z.array(OptionSchema).describe("Sizes, colours or other choices offered"),
  category: z
    .enum(["clothing", "jewellery", "bags", "footwear", "beauty", "home", "art", "food", "accessories", "other"])
    .nullable(),
});

let client: Anthropic | null = null;

export function llmEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

async function callStructured<T extends z.ZodType>(schema: T, system: string, user: string): Promise<z.infer<T> | null> {
  client ??= new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content: user }],
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
    });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
    return (response.parsed_output as z.infer<T> | null) ?? null;
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      console.warn("[import-ai] rate limited");
    } else if (error instanceof Anthropic.APIError) {
      console.warn(`[import-ai] API error ${error.status}: ${error.message}`);
    } else {
      console.warn("[import-ai] failed", error);
    }
    return null;
  }
}

const PAGE_SYSTEM =
  "You extract product listings from online store pages for a marketplace importer. " +
  "Use only facts present in the page text. Never invent prices, sizes or details. " +
  "If the page lists many products (a category or home page), set is_product_page to false.";

const CAPTION_SYSTEM =
  "You read Instagram captions from small Indian sellers and turn sale posts into product listings. " +
  "Prices may be written as ₹, Rs, INR, /- or plain numbers near words like price or only. " +
  "Use only what the caption says. If there is no clear item for sale (memes, announcements, reviews), set is_product to false. " +
  "If the price says DM or is missing, set price_inr to null.";

export const anthropicExtractor: LlmExtractor = {
  async extractFromPage({ url, text, images }): Promise<PageExtract | null> {
    const out = await callStructured(
      PageSchema,
      PAGE_SYSTEM,
      `Page URL: ${url}\n\nCandidate image URLs:\n${images.map((i) => `- ${i}`).join("\n") || "(none)"}\n\nPage text:\n${text}`,
    );
    if (!out) return null;
    const allowed = new Set(images);
    return {
      isProductPage: out.is_product_page,
      title: out.title.trim().slice(0, 140),
      description: out.description.trim().slice(0, 1500),
      pricePaise: rupeesToPaise(out.price),
      compareAtPaise: rupeesToPaise(out.compare_at_price),
      currency: out.currency,
      // only accept images that were actually on the page
      images: out.image_urls.filter((u) => allowed.has(u)).slice(0, 8),
      options: out.options,
      inStock: out.in_stock,
    };
  },

  async parseCaption(caption): Promise<CaptionParse | null> {
    const out = await callStructured(CaptionSchema, CAPTION_SYSTEM, `Caption:\n${caption.slice(0, 4000)}`);
    if (!out) return null;
    return {
      isProduct: out.is_product,
      title: out.title.trim().slice(0, 120),
      description: out.description.trim().slice(0, 1500),
      pricePaise: rupeesToPaise(out.price_inr),
      compareAtPaise: rupeesToPaise(out.compare_at_price_inr),
      options: out.options,
      category: out.category,
    };
  },
};

export function getExtractor(): LlmExtractor | null {
  return llmEnabled() ? anthropicExtractor : null;
}
