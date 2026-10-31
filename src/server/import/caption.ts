import { rupeesToPaise } from "@/lib/money";
import type { CaptionParse } from "./types";

const PRICE_PATTERNS = [
  /(?:₹|rs\.?|inr|price\s*[:\-–]?\s*(?:₹|rs\.?|inr)?)\s*([\d,]{2,7}(?:\.\d{1,2})?)/i,
  /([\d,]{2,7})\s*(?:\/-|rs\b|rupees|inr\b)/i,
];

const MRP_PATTERN = /(?:mrp|original(?:ly)?|was|actual price)\s*[:\-–]?\s*(?:₹|rs\.?|inr)?\s*([\d,]{2,7})/i;

const SIZE_PATTERN = /\bsizes?\s*(?:available)?\s*[:\-–]?\s*([^\n]+)/i;
const SIZE_TOKEN = /^(xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|5xl|free ?size|\d{2}(?:\.\d)?)$/i;

function stripDecor(line: string): string {
  return line
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(/@[\w.]+/g, "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Rule-based caption reader used when the AI fallback is off. Only accepts posts with a clear price. */
export function parseCaptionHeuristic(caption: string): CaptionParse {
  const text = caption.replace(/\r/g, "");
  let price: number | null = null;
  const mrpMatch = text.match(MRP_PATTERN);
  const mrp = mrpMatch ? rupeesToPaise(mrpMatch[1]!.replace(/,/g, "")) : null;
  // look for a price that is not the MRP
  const withoutMrp = mrpMatch ? text.replace(mrpMatch[0], " ") : text;
  for (const re of PRICE_PATTERNS) {
    const m = withoutMrp.match(re);
    if (m) {
      price = rupeesToPaise(m[1]!.replace(/,/g, ""));
      if (price !== null && price >= 1000) break; // ignore amounts under ₹10, likely not a price
      price = null;
    }
  }
  if (price === null && mrp !== null) price = mrp;

  const lines = text.split("\n").map(stripDecor).filter((l) => l.length > 2);
  const firstReal = lines.find((l) => !/^(price|rs|₹|inr|dm|link|shop|order|sizes?)\b/i.test(l)) ?? lines[0] ?? "";
  const title = firstReal.replace(/[.!:,\-–\s]+$/, "").slice(0, 80) || "Instagram product";

  const options: CaptionParse["options"] = [];
  const sizeLine = text.match(SIZE_PATTERN)?.[1];
  if (sizeLine) {
    const values = sizeLine
      .split(/[,/|\s]+/)
      .map((v) => v.trim())
      .filter((v) => SIZE_TOKEN.test(v))
      .map((v) => v.toUpperCase());
    if (values.length) options.push({ name: "Size", values: [...new Set(values)] });
  }

  const description = lines.slice(1).filter((l) => l !== firstReal).join("\n").slice(0, 1500);

  return {
    isProduct: price !== null,
    title,
    description,
    pricePaise: price,
    compareAtPaise: mrp && price && mrp > price ? mrp : null,
    options,
    category: null,
  };
}
