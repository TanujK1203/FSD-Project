// Usage: node scripts/shot.mjs /path [/path2 ...]  (env: BASE, WIDTHS=390,1280, THEMES=light,dark, FULL=1)
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const base = process.env.BASE || "http://localhost:3000";
const widths = (process.env.WIDTHS || "390,1280").split(",").map(Number);
const themes = (process.env.THEMES || "light,dark").split(",");
const out = process.env.OUT || "screenshots";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const path of process.argv.slice(2)) {
  for (const w of widths) for (const theme of themes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, colorScheme: theme, deviceScaleFactor: w < 600 ? 2 : 1, storageState: process.env.STATE || undefined });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(base + path, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(400);
    const name = `${out}/${path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${w}-${theme}.png`;
    await page.screenshot({ path: name, fullPage: process.env.FULL === "1" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(name, overflow ? "HORIZONTAL OVERFLOW" : "", errors.length ? "ERRORS: " + errors.slice(0, 3).join(" | ") : "");
    await ctx.close();
  }
}
await browser.close();
