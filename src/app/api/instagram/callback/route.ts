import { cookies } from "next/headers";
import { NextResponse, after } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { encrypt, safeEqual } from "@/server/crypto";
import { exchangeCode } from "@/server/instagram";
import { createImportJob, runImportJob } from "@/server/import/runner";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = NextResponse.redirect(new URL("/sell/import?ig=error", req.url));
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/sell/import", req.url));
  const store = await db.store.findUnique({ where: { ownerId: user.id } });
  if (!store) return NextResponse.redirect(new URL("/sell/start", req.url));

  const jar = await cookies();
  const expected = jar.get("ig_state")?.value;
  jar.delete("ig_state");
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");
  if (!expected || !safeEqual(expected, state) || !code) return fail;

  try {
    const { token, expiresAt, userId, username } = await exchangeCode(code.replace(/#_$/, ""));
    await db.store.update({
      where: { id: store.id },
      data: {
        igToken: encrypt(token),
        igTokenExpiresAt: expiresAt,
        igUserId: userId || null,
        instagramHandle: store.instagramHandle ?? username,
      },
    });
    const job = await createImportJob(store.id, "instagram:me", "initial");
    after(() => runImportJob(job.id));
    return NextResponse.redirect(new URL(`/sell/import?job=${job.id}`, req.url));
  } catch {
    return fail;
  }
}
