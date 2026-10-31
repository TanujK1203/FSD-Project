// Usage: EMAIL=.. PASSWORD=.. node scripts/shots-auth.mjs /path ...   (WIDTH, THEME, PREFIX)
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const base = process.env.BASE || "http://localhost:3000";
const width = Number(process.env.WIDTH || 1280);
const theme = process.env.THEME || "light";
mkdirSync("screenshots", { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, deviceScaleFactor: width < 600 ? 2 : 1 });
const page = await ctx.newPage();
if (process.env.EMAIL) {
  await page.goto(`${base}/login`);
  await page.getByLabel("Email").fill(process.env.EMAIL);
  await page.getByLabel("Password").fill(process.env.PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForLoadState("networkidle");
}
for (const p of process.argv.slice(2)) {
  await page.goto(base + p, { waitUntil: "networkidle" });
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(500);
  const name = `screenshots/${process.env.PREFIX || ""}${p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${width}-${theme}.png`;
  await page.screenshot({ path: name, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(name, overflow ? "HORIZONTAL OVERFLOW" : "");
}
await browser.close();
