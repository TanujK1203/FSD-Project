export type ImportedVariant = {
  sourceId?: string | null;
  name: string;
  options: Record<string, string>;
  pricePaise: number;
  compareAtPaise?: number | null;
  available: boolean;
  stock?: number | null;
  sku?: string | null;
};

export type ImportedProduct = {
  sourceId: string;
  sourceUrl?: string | null;
  title: string;
  description: string;
  category?: string | null;
  tags: string[];
  images: { url: string; alt?: string | null }[];
  variants: ImportedVariant[];
  currency?: string | null;
  /** set when the seller must check something before publishing */
  needsReview?: string | null;
};

export type LogLevel = "info" | "warn" | "error";

export type ImportContext = {
  log: (message: string, level?: LogLevel) => void;
  found: (n: number) => void;
  maxProducts: number;
  llm: LlmExtractor | null;
  /** set on Instagram imports */
  instagram?: { accessToken: string; userId?: string | null };
};

export type AdapterName = "shopify" | "woocommerce" | "generic" | "instagram";

export type Adapter = {
  name: AdapterName;
  /** complete adapters list every product, so items missing on resync can be marked sold out */
  complete: boolean;
  run: (url: URL, ctx: ImportContext) => AsyncGenerator<ImportedProduct>;
};

export type CaptionParse = {
  isProduct: boolean;
  title: string;
  description: string;
  pricePaise: number | null;
  compareAtPaise: number | null;
  options: { name: string; values: string[] }[];
  category: string | null;
};

export type PageExtract = {
  isProductPage: boolean;
  title: string;
  description: string;
  pricePaise: number | null;
  compareAtPaise: number | null;
  currency: string | null;
  images: string[];
  options: { name: string; values: string[] }[];
  inStock: boolean;
};

export type LlmExtractor = {
  extractFromPage: (input: { url: string; text: string; images: string[] }) => Promise<PageExtract | null>;
  parseCaption: (caption: string) => Promise<CaptionParse | null>;
};
