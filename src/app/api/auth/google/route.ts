import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GOOGLE_COOKIE, googleConfigured, startGoogleSignIn } from "@/server/google";
import { safeNext } from "@/lib/nav";

export async function GET(req: Request) {
  if (!googleConfigured()) redirect("/login?error=google-off");
  const next = safeNext(new URL(req.url).searchParams.get("next"), "");
  const { url, state, verifier } = startGoogleSignIn();
  (await cookies()).set(GOOGLE_COOKIE, JSON.stringify({ state, verifier, next }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: 600,
  });
  redirect(url);
}
