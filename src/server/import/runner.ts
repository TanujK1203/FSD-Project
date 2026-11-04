import type { SourceType } from "@prisma/client";
import { db } from "../db";
import { decrypt } from "../crypto";
import { IMPORT } from "@/config";
import { ADAPTERS, detectStore, normalizeInputUrl } from "./detect";
import { getExtractor } from "./llm";
import { saveRemoteImage } from "../media";
import { markMissingSoldOut, saveImported } from "./save";
import { closeBrowser } from "./render";
import { findInstagramPicture, findSiteLogo } from "./logo";
import type { AdapterName, ImportContext, LogLevel } from "./types";

export type JobLogLine = { t: number; level: LogLevel; msg: string };

const SOURCE_TYPE: Record<AdapterName, SourceType> = {
  shopify: "SHOPIFY",
  woocommerce: "WOOCOMMERCE",
  generic: "GENERIC",
  instagram: "INSTAGRAM",
};

export async function createImportJob(storeId: string, sourceUrl: string, kind: "initial" | "resync" = "initial") {
  // one active job per store
  const active = await db.importJob.findFirst({ where: { storeId, status: { in: ["QUEUED", "RUNNING"] } } });
  if (active) return active;
  return db.importJob.create({ data: { storeId, sourceUrl, kind } });
}

const running = new Set<string>();

export async function runImportJob(jobId: string) {
  if (running.has(jobId)) return;
  running.add(jobId);
  const job = await db.importJob.findUnique({ where: { id: jobId }, include: { store: true } });
  if (!job || job.status !== "QUEUED") {
    running.delete(jobId);
    return;
  }

  const logs: JobLogLine[] = [];
  const counts = { found: 0, created: 0, updated: 0, skipped: 0, failed: 0 };
  let lastFlush = 0;
  const flush = async (force = false) => {
    if (!force && Date.now() - lastFlush < 700) return;
    lastFlush = Date.now();
    await db.importJob.update({
      where: { id: jobId },
      data: { ...counts, logJson: JSON.stringify(logs.slice(-200)) },
    });
  };
  const log = (msg: string, level: LogLevel = "info") => {
    logs.push({ t: Date.now(), level, msg });
  };

  await db.importJob.update({ where: { id: jobId }, data: { status: "RUNNING", startedAt: new Date() } });

  try {
    let adapterName: AdapterName;
    let url: URL;
    let instagram: ImportContext["instagram"];

    if (job.sourceUrl.startsWith("instagram:")) {
      if (!job.store.igToken) throw new Error("Instagram is not connected for this store");
      adapterName = "instagram";
      url = new URL("https://graph.instagram.com/");
      instagram = { accessToken: decrypt(job.store.igToken), userId: job.store.igUserId };
      log("Reading your Instagram posts");
    } else {
      const parsed = normalizeInputUrl(job.sourceUrl);
      if (!parsed) throw new Error("That does not look like a web address");
      log(`Looking at ${parsed.hostname}`);
      await flush(true);
      const detection = await detectStore(parsed);
      if (detection.kind === "instagram") {
        throw new Error("This is an Instagram link. Use Connect Instagram instead, or paste your store website.");
      }
      if (detection.kind === "social") {
        throw new Error(`${detection.host} is not a store website. Paste the link to your online store.`);
      }
      adapterName = detection.adapter;
      url = detection.url;
      log(
        adapterName === "shopify"
          ? "Shopify store found"
          : adapterName === "woocommerce"
            ? "WooCommerce store found"
            : "Reading product pages from the site",
      );
    }

    await db.importJob.update({ where: { id: jobId }, data: { adapter: adapterName } });
    const adapter = ADAPTERS[adapterName];
    const llm = getExtractor();
    if (!llm && adapterName === "generic") log("AI reader is off; only pages with standard product data will import", "info");

    const ctx: ImportContext = {
      log,
      found: (n) => {
        counts.found += n;
      },
      maxProducts: IMPORT.maxProducts,
      llm,
      instagram,
    };

    const seen = new Set<string>();
    for await (const product of adapter.run(url, ctx)) {
      seen.add(product.sourceId);
      try {
        if (adapterName === "instagram") {
          // Instagram image links expire, so keep our own copy
          const local: { url: string }[] = [];
          for (const img of product.images) {
            try {
              local.push({ url: await saveRemoteImage(img.url, job.storeId) });
            } catch {
              log("Could not save one photo", "warn");
            }
          }
          product.images = local;
        }
        const result = await saveImported(job.storeId, job.store.name, product);
        counts[result]++;
      } catch (e) {
        counts.failed++;
        log(`Could not save "${product.title.slice(0, 60)}": ${(e as Error).message}`, "warn");
      }
      await flush();
    }

    if (adapter.complete && job.kind === "resync") {
      const prefix = adapterName === "shopify" ? "shopify:" : "woo:";
      const n = await markMissingSoldOut(job.storeId, prefix, seen);
      if (n) log(`${n} products are no longer on your site and were marked sold out`);
    }

    if (counts.created + counts.updated === 0) {
      throw new Error(
        adapterName === "instagram"
          ? "No posts with a product and price were found."
          : "No products could be read from this site.",
      );
    }

    log(`Done. ${counts.created} new, ${counts.updated} updated.`);
    await db.importJob.update({
      where: { id: jobId },
      data: { ...counts, status: "DONE", finishedAt: new Date(), logJson: JSON.stringify(logs.slice(-200)) },
    });
    await db.store.update({
      where: { id: job.storeId },
      data: {
        lastSyncedAt: new Date(),
        sourceType: SOURCE_TYPE[adapterName],
        ...(adapterName !== "instagram" ? { sourceUrl: url.origin } : {}),
      },
    });
    if (!job.store.logoUrl) await saveStoreLogo(job.storeId, adapterName === "instagram" ? null : url.origin, instagram);
  } catch (e) {
    const message = (e as Error).message || "Import failed";
    log(message, "error");
    await db.importJob.update({
      where: { id: jobId },
      data: { ...counts, status: "FAILED", error: message, finishedAt: new Date(), logJson: JSON.stringify(logs.slice(-200)) },
    });
  } finally {
    running.delete(jobId);
    // free the browser between jobs when nothing else is running
    if (running.size === 0) await closeBrowser();
  }
}

/** Use the store's own logo (or Instagram profile picture) for its circle, unless the seller uploaded one. */
async function saveStoreLogo(storeId: string, origin: string | null, instagram: ImportContext["instagram"]) {
  try {
    let logoUrl: string | null = null;
    if (origin) {
      logoUrl = await findSiteLogo(origin);
    } else if (instagram) {
      // Instagram picture links expire, so keep our own copy
      const src = await findInstagramPicture(instagram.accessToken);
      if (src) logoUrl = await saveRemoteImage(src, storeId);
    }
    // a seller upload during the import wins
    if (logoUrl) await db.store.updateMany({ where: { id: storeId, logoUrl: null }, data: { logoUrl } });
  } catch {}
}

/** Pick up jobs left queued (e.g. after a restart) and resync stores daily. */
export async function runPendingJobs(limit = 3) {
  const jobs = await db.importJob.findMany({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" }, take: limit });
  for (const j of jobs) await runImportJob(j.id);
  return jobs.length;
}

export async function queueDailyResyncs() {
  const cutoff = new Date(Date.now() - 22 * 3600 * 1000);
  const stores = await db.store.findMany({
    where: {
      status: "APPROVED",
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }],
      NOT: { sourceType: "MANUAL" },
    },
    select: { id: true, sourceUrl: true, sourceType: true, igToken: true },
  });
  let queued = 0;
  for (const s of stores) {
    const source = s.sourceType === "INSTAGRAM" ? (s.igToken ? "instagram:me" : null) : s.sourceUrl;
    if (!source) continue;
    await createImportJob(s.id, source, "resync");
    queued++;
  }
  return queued;
}
