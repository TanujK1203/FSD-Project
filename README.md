# haat (working name)

A shopping app for small sellers. Buyers shop many small stores with one cart and one checkout. Sellers join by pasting their store link or connecting Instagram, and their products are imported for them.

## Run it

```bash
npm install
cp .env.example .env        # then set APP_SECRET and ADMIN_PASSWORD
npx prisma db push          # creates the SQLite database in storage/
npm run db:seed             # creates the admin account from .env
npm run dev                 # http://localhost:3000
```

Optional: load real demo stores (creates seller accounts with password `seller12345`, approves them, publishes products):

```bash
IMPORT_MAX_PRODUCTS=28 npx tsx scripts/demo-import.ts "https://suta.in|Suta" "https://www.okhai.org|Okhai"
```

## What is in it

| Module | Where |
|---|---|
| Users and auth (signup, login, profile, saved addresses) | `src/server/auth.ts`, `src/app/account`, `src/app/actions/auth.ts` |
| Seller onboarding ("Join us"), store setup, product listing | `src/app/sell/*`, `src/app/seller/*` |
| Product import (scraping) | `src/server/import/*` |
| Catalog, search, filters, compare across sellers | `src/server/catalog.ts`, `src/app/search`, `src/app/p/[slug]` |
| One cart across sellers, single-address checkout | `src/server/cart.ts`, `src/app/cart`, `src/app/checkout` |
| Payments (test gateway) and seller payouts | `src/server/payments/*`, `src/server/orders.ts`, `src/app/pay` |
| Orders, per-seller shipments, tracking, reviews | `src/app/orders`, `src/app/seller/orders` |
| Admin: approve stores, import logs, orders, payouts, users | `src/app/admin/*` |

## How importing works

`src/server/import/detect.ts` looks at the link and picks an adapter:

1. **Shopify**: reads the public `/products.json` feed. Fast and complete.
2. **WooCommerce**: reads the public Store API.
3. **Any other site** (Dukaan, Instamojo, Wix, custom): finds product pages through the sitemap or site links, then reads the structured product data most stores publish for Google (JSON-LD, microdata, OpenGraph). Pages that only show data after JavaScript runs are opened in headless Chromium.
4. **AI fallback** (needs `ANTHROPIC_API_KEY`): pages with no structured data are read by Claude, which returns the name, price, photos and options.
5. **Instagram**: the seller logs in with an Instagram Business or Creator account (official API, `instagram_business_basic`). Their posts are read, and posts with a price become drafts. Captions are parsed by Claude when the key is set, otherwise by rules that need a clear price. Photos are copied locally because Instagram image links expire.

Everything arrives as drafts. The seller checks and publishes. The admin approves each store once. Prices and stock re-sync daily (call `POST /api/cron/resync` with `Authorization: Bearer $APP_SECRET` from any scheduler) or when the seller clicks Sync now.

Safety: every request (including those made by the headless browser) is checked so it cannot reach private or internal addresses; robots.txt is respected for crawling; imports are capped at 500 products.

Known limits: sites behind bot protection (Cloudflare "checking your browser") cannot be read; WooCommerce per-option prices are not in the public API, so options get the main price and are flagged for review.

## Settings to decide

`src/config.ts` holds placeholder values: the site name, commission (5%), shipping per seller (₹49, free from ₹999).

To turn on Instagram connect, create a Meta developer app with Instagram API with Instagram Login, add `APP_URL/api/instagram/callback` as the redirect URL, and set `IG_APP_ID` and `IG_APP_SECRET`. Until the app passes Meta App Review, only Instagram accounts added as testers can connect.

The AI fallback uses `claude-opus-5-5` at low effort by default; set `IMPORT_AI_MODEL=claude-haiku-5-5` for a cheaper option.

## Checks

```bash
npm run typecheck
npm run lint
npm test               # unit tests: importer, prices, SSRF guard
npm run check:slop     # design rule check
npm run e2e            # full flow against a running server (BASE=http://localhost:3000)
```

## Moving to production

- Switch `provider` in `prisma/schema.prisma` to `postgresql` and set `DATABASE_URL`.
- Replace the test gateway in `src/server/payments/mock.ts` with a real provider (Razorpay Route can split each payment to seller bank accounts).
- Uploaded and Instagram images are stored in `storage/media`; use object storage when running more than one server.
