// End-to-end run against a running server. Usage: BASE=http://localhost:3000 node scripts/e2e.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const STORE_URL = process.env.STORE_URL || "https://bombaysweetshop.com";
const ADMIN = { email: process.env.ADMIN_EMAIL || "admin@example.com", password: process.env.ADMIN_PASSWORD || "admin12345" };
const run = Date.now().toString(36);
const seller = { name: "Asha Rao", email: `seller-${run}@test.local`, password: "sellerpass1", store: `Test Sweets ${run}` };
const buyer = { name: "Ravi Kumar", email: `buyer-${run}@test.local`, password: "buyerpass1" };
mkdirSync("screenshots/e2e", { recursive: true });

const browser = await chromium.launch();
const errors = [];
async function newUser(width = 390) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: `screenshots/e2e/${name}.png`, fullPage: true });
const step = (msg) => console.log(`- ${msg}`);
function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

try {
  // 1. Seller joins and imports
  const s = await newUser();
  await s.page.goto(`${BASE}/sell`);
  await s.page.getByRole("link", { name: "Start selling" }).first().click();
  await s.page.getByLabel("Store name").fill(seller.store);
  await s.page.getByLabel("City").fill("Mumbai");
  await s.page.getByLabel("Your name").fill(seller.name);
  await s.page.getByLabel("Email").fill(seller.email);
  await s.page.getByLabel("Password").fill(seller.password);
  await shot(s.page, "01-sell-start");
  await s.page.getByRole("button", { name: "Continue to import" }).click();
  await s.page.waitForURL(/\/sell\/import/);
  step("seller account and store created");
  await s.page.getByLabel("Store link").fill(STORE_URL);
  await s.page.getByRole("button", { name: "Import", exact: true }).click();
  await s.page.waitForURL(/job=/);
  await s.page.getByText("Import finished").waitFor({ timeout: 180000 });
  await shot(s.page, "02-import-done");
  const created = Number(await s.page.locator(".import-counts dd").first().innerText());
  assert(created > 0, "import created drafts");
  step(`import finished with ${created} drafts`);
  await s.page.getByRole("link", { name: /Review/ }).click();
  await s.page.waitForURL(/\/sell\/review/);
  await shot(s.page, "03-review");
  await s.page.getByRole("button", { name: "Publish selected" }).click();
  await s.page.waitForLoadState("networkidle");
  step("drafts published (store still pending)");

  // 2. Admin approves
  const a = await newUser(1280);
  await a.page.goto(`${BASE}/login?next=/admin`);
  await a.page.getByLabel("Email").fill(ADMIN.email);
  await a.page.getByLabel("Password").fill(ADMIN.password);
  await a.page.getByRole("button", { name: "Sign in" }).click();
  await a.page.waitForURL(/\/admin/);
  const row = a.page.locator("tr", { hasText: seller.store });
  await row.waitFor();
  await shot(a.page, "04-admin-pending");
  await row.getByRole("button", { name: "Approve" }).click();
  await a.page.waitForLoadState("networkidle");
  await a.page.goto(`${BASE}/admin?status=APPROVED`);
  await a.page.locator("tr", { hasText: seller.store }).waitFor();
  step("admin approved the store");

  // 3. Buyer shops from two stores
  const b = await newUser();
  await b.page.goto(`${BASE}/`);
  await shot(b.page, "05-home");
  const storeSlug = seller.store.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  await b.page.goto(`${BASE}/s/${storeSlug}`);
  const firstProduct = b.page.locator(".pcard").filter({ has: b.page.getByRole("button", { name: "Add" }) }).first();
  await firstProduct.getByRole("button", { name: "Add" }).click();
  await b.page.getByRole("button", { name: "Added" }).first().waitFor();
  step("added from new store via card");
  await b.page.goto(`${BASE}/search?q=tote`);
  await shot(b.page, "06-search");
  await b.page.locator(".pcard__title a").first().click();
  await b.page.waitForURL(/\/p\//);
  await shot(b.page, "07-product");
  await b.page.getByRole("button", { name: "Add to cart" }).click();
  await b.page.getByText("Added to your cart").waitFor();
  await b.page.goto(`${BASE}/cart`);
  const groups = await b.page.locator("section[aria-label^='Items from']").count();
  assert(groups === 2, `cart has 2 seller groups (got ${groups})`);
  await shot(b.page, "08-cart");
  step("cart groups items by 2 sellers");
  await b.page.getByRole("link", { name: "Checkout" }).click();
  await b.page.waitForURL(/\/login/);
  await b.page.getByRole("link", { name: "Create an account" }).click();
  await b.page.getByLabel("Name").fill(buyer.name);
  await b.page.getByLabel("Email").fill(buyer.email);
  await b.page.getByLabel("Password").fill(buyer.password);
  await b.page.getByRole("button", { name: "Create account" }).click();
  await b.page.waitForURL(/\/checkout/);
  await b.page.getByLabel("Mobile number").fill("9876543210");
  await b.page.getByLabel("House, building, street").fill("12 MG Road, Flat 4B");
  await b.page.getByLabel("City").fill("Pune");
  await b.page.getByLabel("PIN code").fill("411001");
  await b.page.getByLabel("State").selectOption("Maharashtra");
  await b.page.getByRole("button", { name: "Use this address" }).click();
  await b.page.getByRole("button", { name: "Place order and pay" }).waitFor();
  await shot(b.page, "09-checkout");
  await b.page.getByRole("button", { name: "Place order and pay" }).click();
  await b.page.waitForURL(/\/pay\//);
  await shot(b.page, "10-pay");
  await b.page.getByRole("button", { name: /^Pay / }).click();
  await b.page.waitForURL(/\/orders\/.+placed=1/);
  const shipments = await b.page.locator("section[aria-label^='Shipment from']").count();
  assert(shipments === 2, `order split into 2 shipments (got ${shipments})`);
  await shot(b.page, "11-order-placed");
  const orderUrl = b.page.url().split("?")[0];
  step("paid with the test gateway, order split into 2 shipments");

  // 4. Seller fulfils
  await s.page.goto(`${BASE}/seller/orders`);
  await s.page.getByRole("button", { name: "Mark as packed" }).click();
  await s.page.getByRole("button", { name: "Mark as shipped" }).waitFor();
  await s.page.getByLabel("Courier").fill("Delhivery");
  await s.page.getByLabel("Tracking number").fill("DLV123456789");
  await shot(s.page, "12-seller-ship");
  await s.page.getByRole("button", { name: "Mark as shipped" }).click();
  await s.page.getByText("No orders waiting").waitFor();
  await s.page.goto(`${BASE}/seller/orders?tab=shipped`);
  await s.page.getByRole("button", { name: "Mark as delivered" }).click();
  await s.page.getByText("Nothing here yet").waitFor();
  await s.page.goto(`${BASE}/seller/payouts`);
  await s.page.getByText("Ready", { exact: true }).waitFor();
  await shot(s.page, "13-seller-payouts");
  step("seller packed, shipped with tracking, delivered; payout is ready");

  // 5. Buyer sees tracking and reviews
  await b.page.goto(orderUrl);
  await b.page.getByText("DLV123456789").waitFor();
  await b.page.getByRole("button", { name: "Write a review" }).first().click();
  await b.page.getByRole("button", { name: "Rate 5 stars" }).click();
  await b.page.getByPlaceholder(/What was it like/).fill("Fresh and well packed.");
  await b.page.getByRole("button", { name: "Post review" }).click();
  await b.page.getByText("You rated this 5 of 5").waitFor();
  await shot(b.page, "14-order-delivered");
  step("buyer saw tracking and posted a review");

  // 6. Admin settles payout
  await a.page.goto(`${BASE}/admin/payouts`);
  const payoutForm = a.page.locator("form", { hasText: seller.store });
  await payoutForm.getByRole("button", { name: /Mark 1 paid/ }).click();
  await a.page.waitForLoadState("networkidle");
  assert((await a.page.locator("form", { hasText: seller.store }).count()) === 0, "payout settled");
  step("admin marked the payout as paid");

  console.log(errors.length ? `\nPage errors:\n${errors.join("\n")}` : "\nNo page errors.");
  console.log("E2E PASSED");
} catch (e) {
  console.error(e.message);
  console.log(errors.length ? `Page errors:\n${errors.join("\n")}` : "");
  process.exitCode = 1;
} finally {
  await browser.close();
}
