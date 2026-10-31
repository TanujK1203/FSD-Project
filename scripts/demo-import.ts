/**
 * Dev helper: create seller accounts for a few real store URLs, import their products,
 * approve the stores and publish the drafts that need no review.
 * Usage: IMPORT_MAX_PRODUCTS=30 npx tsx scripts/demo-import.ts "https://suta.in|Suta" ...
 */
import { db } from "../src/server/db";
import { createImportJob, runImportJob } from "../src/server/import/runner";
import { hashPassword } from "./lib-password";
import { slugify } from "../src/lib/text";

async function main() {
  const args = process.argv.slice(2);
  for (const arg of args) {
    const [url, nameArg] = arg.split("|");
    const host = new URL(url!).hostname.replace(/^www\./, "");
    const name = nameArg || host.split(".")[0]!.replace(/^./, (c) => c.toUpperCase());
    const email = `seller+${slugify(host)}@demo.local`;
    const user = await db.user.upsert({
      where: { email },
      create: { email, name: `${name} owner`, role: "SELLER", passwordHash: await hashPassword("seller12345") },
      update: {},
    });
    const store = await db.store.upsert({
      where: { ownerId: user.id },
      create: { ownerId: user.id, name, slug: slugify(name), sourceUrl: url, city: null },
      update: {},
    });
    const job = await createImportJob(store.id, url!);
    const started = Date.now();
    await runImportJob(job.id);
    const done = await db.importJob.findUnique({ where: { id: job.id } });
    console.log(`${name}: ${done?.status} adapter=${done?.adapter} found=${done?.found} created=${done?.created} updated=${done?.updated} failed=${done?.failed} in ${((Date.now() - started) / 1000).toFixed(1)}s ${done?.error ?? ""}`);
    const logs = JSON.parse(done?.logJson ?? "[]") as { msg: string }[];
    for (const l of logs.slice(-6)) console.log("   ", l.msg);
    if (process.env.APPROVE !== "0" && done?.status === "DONE") {
      await db.store.update({ where: { id: store.id }, data: { status: "APPROVED", approvedAt: new Date() } });
      const r = await db.product.updateMany({
        where: { storeId: store.id, status: "DRAFT", needsReview: null },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
      console.log(`    approved store, published ${r.count}`);
    }
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
