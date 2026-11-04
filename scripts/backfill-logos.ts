/**
 * Find logos for website stores that have none (stores imported before logos were picked up).
 * Usage: npx tsx scripts/backfill-logos.ts
 */
import { db } from "../src/server/db";
import { findSiteLogo } from "../src/server/import/logo";

async function main() {
  const stores = await db.store.findMany({
    where: { logoUrl: null, sourceUrl: { not: null }, NOT: { sourceType: { in: ["INSTAGRAM", "MANUAL"] } } },
    select: { id: true, name: true, sourceUrl: true },
  });
  for (const s of stores) {
    const logo = await findSiteLogo(s.sourceUrl!).catch(() => null);
    if (logo) await db.store.update({ where: { id: s.id }, data: { logoUrl: logo } });
    console.log(`${s.name}: ${logo ?? "no logo found, the circle shows a product photo"}`);
  }
}

main().finally(() => db.$disconnect());
