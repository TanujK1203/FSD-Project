export const CATEGORIES = [
  { slug: "clothing", label: "Clothing", keywords: ["kurta", "kurti", "saree", "sari", "dress", "top", "shirt", "tshirt", "t-shirt", "tee", "lehenga", "dupatta", "skirt", "pant", "trouser", "jeans", "co-ord", "coord", "blouse", "jacket", "hoodie", "sweatshirt", "anarkali", "palazzo", "salwar", "suit", "shrug", "kaftan", "jumpsuit", "apparel", "clothing"] },
  { slug: "jewellery", label: "Jewellery", keywords: ["earring", "jhumka", "necklace", "ring", "bracelet", "bangle", "anklet", "pendant", "chain", "nose pin", "nosepin", "choker", "jewellery", "jewelry", "studs", "maang tikka"] },
  { slug: "bags", label: "Bags", keywords: ["bag", "tote", "clutch", "potli", "sling", "backpack", "purse", "wallet", "pouch"] },
  { slug: "footwear", label: "Footwear", keywords: ["shoe", "sandal", "jutti", "mojari", "kolhapuri", "slipper", "heel", "sneaker", "flat", "footwear"] },
  { slug: "beauty", label: "Beauty", keywords: ["soap", "serum", "cream", "lip", "balm", "oil", "face", "skin", "hair", "scrub", "perfume", "attar", "candle", "beauty", "skincare"] },
  { slug: "home", label: "Home", keywords: ["cushion", "bedsheet", "bed sheet", "curtain", "rug", "mat", "planter", "vase", "mug", "plate", "bowl", "lamp", "decor", "home", "table", "coaster", "towel", "quilt", "throw"] },
  { slug: "art", label: "Art & craft", keywords: ["painting", "print", "art", "craft", "resin", "macrame", "embroidery", "hoop", "frame", "handmade", "sketch", "illustration", "poster"] },
  { slug: "food", label: "Food", keywords: ["cookie", "cake", "chocolate", "pickle", "achar", "tea", "coffee", "masala", "spice", "snack", "honey", "ghee", "jam", "brownie", "granola", "food"] },
  { slug: "accessories", label: "Accessories", keywords: ["scarf", "stole", "hair clip", "scrunchie", "watch", "sunglass", "belt", "cap", "hat", "keychain", "mask", "accessor"] },
  { slug: "other", label: "Other", keywords: [] },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export function categoryLabel(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? "Other";
}

export function isCategory(slug: string): slug is CategorySlug {
  return CATEGORIES.some((c) => c.slug === slug);
}

/** Guess a category from free text (product type, tags, title). */
export function guessCategory(...texts: (string | null | undefined)[]): CategorySlug {
  const hay = ` ${texts.filter(Boolean).join(" ").toLowerCase()} `;
  let best: { slug: CategorySlug; score: number } = { slug: "other", score: 0 };
  for (const c of CATEGORIES) {
    let score = 0;
    for (const k of c.keywords) {
      // word-start match so "ring" does not match "earring", but "earrings" matches "earring"
      const re = new RegExp(`(^|[^a-z])${k.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}`);
      if (re.test(hay)) score += k.length > 4 ? 2 : 1;
    }
    if (score > best.score) best = { slug: c.slug, score };
  }
  return best.slug;
}
