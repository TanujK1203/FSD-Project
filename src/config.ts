// Site-wide settings. Values marked PLACEHOLDER are waiting on a decision from the owner.

export const SITE = {
  // PLACEHOLDER: brand name until the owner picks one
  name: "haat",
  description: "Shop small sellers from Instagram and independent stores, in one cart.",
};

export const COMMERCE = {
  currency: "INR",
  // PLACEHOLDER: platform commission taken from each seller order (0.05 = 5%)
  commissionRate: 0.05,
  // PLACEHOLDER: shipping charged per seller in a cart
  shippingPerSellerPaise: 4900,
  // PLACEHOLDER: a seller's part of the cart ships free at or above this amount
  freeShippingThresholdPaise: 99900,
  maxQuantityPerItem: 10,
};

export const IMPORT = {
  maxProducts: Number(process.env.IMPORT_MAX_PRODUCTS) || 500,
  maxPagesGeneric: 300,
  maxLlmPages: 40,
  concurrency: 3,
  requestTimeoutMs: 15000,
  maxResponseBytes: 8 * 1024 * 1024,
  userAgent: `${"haat"}-importer/1.0 (+product import on behalf of the store owner)`,
  instagramMaxPosts: 150,
};
