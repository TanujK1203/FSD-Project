import { assertPublicUrl } from "./safeFetch";

type Browser = import("playwright-core").Browser;

let browserPromise: Promise<Browser | null> | null = null;

async function getBrowser(): Promise<Browser | null> {
  if (!browserPromise) {
    browserPromise = (async () => {
      try {
        const { chromium } = await import("playwright-core");
        return await chromium.launch({
          executablePath: process.env.CHROMIUM_PATH || undefined,
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        });
      } catch {
        return null;
      }
    })();
  }
  return browserPromise;
}

export async function renderAvailable() {
  return (await getBrowser()) !== null;
}

/**
 * Load a page in headless Chromium and return the rendered HTML.
 * Every request the page makes is checked so a rendered page cannot reach private addresses.
 */
export async function renderPage(
  url: string,
  opts: { timeoutMs?: number; waitForProductData?: boolean } = {},
): Promise<string | null> {
  const timeoutMs = opts.timeoutMs ?? 25000;
  await assertPublicUrl(url);
  const browser = await getBrowser();
  if (!browser) return null;
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36",
    viewport: { width: 412, height: 900 },
    javaScriptEnabled: true,
  });
  const hostOk = new Map<string, Promise<boolean>>();
  const checkHost = (u: string) => {
    let host: string;
    try {
      const parsed = new URL(u);
      if (parsed.protocol === "data:" || parsed.protocol === "blob:") return Promise.resolve(true);
      host = `${parsed.protocol}//${parsed.host}`;
    } catch {
      return Promise.resolve(false);
    }
    if (!hostOk.has(host)) {
      hostOk.set(
        host,
        assertPublicUrl(host).then(
          () => true,
          () => false,
        ),
      );
    }
    return hostOk.get(host)!;
  };
  try {
    await context.route("**/*", async (route) => {
      const req = route.request();
      const type = req.resourceType();
      if (["media", "font"].includes(type)) return route.abort();
      return (await checkHost(req.url())) ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    if (opts.waitForProductData) {
      // product pages: stop as soon as Product structured data shows up
      await page
        .waitForFunction(
          () =>
            Array.from(document.querySelectorAll('script[type="application/ld+json"]')).some((s) =>
              /"@type"\s*:\s*"(Product|ProductGroup)"/.test(s.textContent || ""),
            ) || !!document.querySelector('[itemtype*="schema.org/Product"]'),
          undefined,
          { timeout: 7000 },
        )
        .catch(() => {});
    } else {
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      // scroll once to trigger lazy loading
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
      await page.waitForTimeout(800);
    }
    return await page.content();
  } catch {
    return null;
  } finally {
    await context.close().catch(() => {});
  }
}

export async function closeBrowser() {
  if (!browserPromise) return;
  const b = await browserPromise;
  browserPromise = null;
  await b?.close().catch(() => {});
}
