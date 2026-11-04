import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";
import { randomToken } from "./crypto";

/**
 * "Continue with Google" (OAuth 2.0 authorization code flow with PKCE).
 * Needs an OAuth client from Google Cloud Console with the redirect URI
 * `${APP_URL}/api/auth/google/callback`.
 */
export const GOOGLE_COOKIE = "g_oauth";

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.APP_URL);
}

function redirectUri() {
  return `${process.env.APP_URL!.replace(/\/$/, "")}/api/auth/google/callback`;
}

export type GoogleStart = { url: string; state: string; verifier: string };

export function startGoogleSignIn(): GoogleStart {
  const state = randomToken(16);
  const verifier = randomToken(32);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const qs = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${qs}`, state, verifier };
}

export type GoogleProfile = { sub: string; email: string; emailVerified: boolean; name: string };

export async function finishGoogleSignIn(code: string, verifier: string): Promise<GoogleProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const token = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenRes.ok || !token.access_token) throw new Error(`Google token exchange failed: ${token.error ?? tokenRes.status}`);

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  const info = (await infoRes.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string };
  if (!infoRes.ok || !info.sub || !info.email) throw new Error("Google did not return a profile");
  return {
    sub: info.sub,
    email: info.email.toLowerCase(),
    emailVerified: info.email_verified === true,
    name: info.name?.trim() || info.email.split("@")[0]!,
  };
}

/** Find the account for this Google profile, linking or creating one as needed. */
export async function userForGoogle(profile: GoogleProfile) {
  const linked = await db.user.findFirst({ where: { googleId: profile.sub } });
  if (linked) return linked;
  // only trust the email for linking when Google has verified it
  if (!profile.emailVerified) throw new Error("Google email is not verified");
  const byEmail = await db.user.findUnique({ where: { email: profile.email } });
  if (byEmail) return db.user.update({ where: { id: byEmail.id }, data: { googleId: profile.sub } });
  return db.user.create({ data: { email: profile.email, name: profile.name.slice(0, 80), googleId: profile.sub } });
}
