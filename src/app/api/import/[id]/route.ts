import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { runImportJob } from "@/server/import/runner";
import { after } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { id } = await params;
  const job = await db.importJob.findUnique({ where: { id }, include: { store: { select: { ownerId: true } } } });
  if (!job || (job.store.ownerId !== user.id && user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // a job can be left queued if the server restarted; pick it up
  if (job.status === "QUEUED" && Date.now() - job.createdAt.getTime() > 10_000) after(() => runImportJob(job.id));
  const logs = (JSON.parse(job.logJson) as { level: string; msg: string }[]).slice(-8);
  return NextResponse.json({
    status: job.status,
    adapter: job.adapter,
    found: job.found,
    created: job.created,
    updated: job.updated,
    skipped: job.skipped,
    failed: job.failed,
    error: job.error,
    logs,
  });
}
