import { NextResponse, after } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { createImportJob, runImportJob } from "@/server/import/runner";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/sell/import", req.url), 303);
  const store = await db.store.findUnique({ where: { ownerId: user.id } });
  if (!store?.igToken) return NextResponse.redirect(new URL("/sell/import", req.url), 303);
  const job = await createImportJob(store.id, "instagram:me", store.lastSyncedAt ? "resync" : "initial");
  after(() => runImportJob(job.id));
  return NextResponse.redirect(new URL(`/sell/import?job=${job.id}`, req.url), 303);
}
