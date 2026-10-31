import { NextResponse, after } from "next/server";
import { safeEqual } from "@/server/crypto";
import { queueDailyResyncs, runPendingJobs } from "@/server/import/runner";

/** Call daily from a scheduler: POST /api/cron/resync with header "authorization: Bearer <APP_SECRET>". */
export async function POST(req: Request) {
  const secret = process.env.APP_SECRET ?? "";
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !safeEqual(auth, secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const queued = await queueDailyResyncs();
  after(async () => {
    for (let i = 0; i < 50 && (await runPendingJobs(2)) > 0; i++) {}
  });
  return NextResponse.json({ queued });
}
