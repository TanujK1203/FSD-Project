import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, homeFor } from "@/server/auth";
import { mergeGuestCart } from "@/server/cart";
import { safeEqual } from "@/server/crypto";
import { GOOGLE_COOKIE, finishGoogleSignIn, userForGoogle } from "@/server/google";
import { safeNext } from "@/lib/nav";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const jar = await cookies();
  const saved = jar.get(GOOGLE_COOKIE)?.value;
  jar.delete({ name: GOOGLE_COOKIE, path: "/api/auth/google" });

  let started: { state: string; verifier: string; next: string } | null = null;
  try {
    started = saved ? JSON.parse(saved) : null;
  } catch {}
  const code = params.get("code");
  // the visitor cancelled on Google's screen
  if (params.get("error") === "access_denied") redirect("/login");
  if (!started || !code || !safeEqual(started.state, params.get("state") ?? "")) redirect("/login?error=google");

  let destination: string;
  try {
    const profile = await finishGoogleSignIn(code, started.verifier);
    const user = await userForGoogle(profile);
    await createSession(user.id);
    await mergeGuestCart(user.id);
    destination = safeNext(started.next, homeFor(user.role));
  } catch (e) {
    console.warn("[google] sign-in failed:", (e as Error).message);
    destination = "/login?error=google";
  }
  redirect(destination);
}
