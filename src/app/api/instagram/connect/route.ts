import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { randomToken } from "@/server/crypto";
import { authorizeUrl, instagramConfigured } from "@/server/instagram";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/sell/import", req.url));
  const store = await db.store.findUnique({ where: { ownerId: user.id } });
  if (!store) return NextResponse.redirect(new URL("/sell/start", req.url));
  if (!instagramConfigured()) return NextResponse.redirect(new URL("/sell/import", req.url));
  const state = randomToken(16);
  (await cookies()).set("ig_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: process.env.NODE_ENV === "production" });
  return NextResponse.redirect(authorizeUrl(state));
}
