import "server-only";
import { parseJson, safeFetch } from "./import/safeFetch";

/**
 * Instagram API with Instagram Login (Business and Creator accounts).
 * Needs a Meta developer app with the instagram_business_basic permission.
 * Until the app passes Meta App Review, only accounts added as testers in the app can connect.
 */
export function instagramConfigured() {
  return Boolean(process.env.IG_APP_ID && process.env.IG_APP_SECRET && process.env.APP_URL);
}

export function redirectUri() {
  return `${process.env.APP_URL!.replace(/\/$/, "")}/api/instagram/callback`;
}

export function authorizeUrl(state: string) {
  const qs = new URLSearchParams({
    client_id: process.env.IG_APP_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "instagram_business_basic",
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${qs}`;
}

/** Code -> short-lived token -> long-lived (about 60 days) token. */
export async function exchangeCode(code: string) {
  const body = new URLSearchParams({
    client_id: process.env.IG_APP_ID!,
    client_secret: process.env.IG_APP_SECRET!,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
    code,
  });
  const shortRes = await safeFetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: body.toString(),
    accept: "application/json",
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
  const short = parseJson<{ access_token?: string; user_id?: number | string }>(shortRes);
  if (!short?.access_token) throw new Error("Instagram did not return a token");

  const longRes = await safeFetch(
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(
      process.env.IG_APP_SECRET!,
    )}&access_token=${encodeURIComponent(short.access_token)}`,
    { accept: "application/json" },
  );
  const long = parseJson<{ access_token?: string; expires_in?: number }>(longRes);
  const token = long?.access_token ?? short.access_token;
  const expiresAt = new Date(Date.now() + (long?.expires_in ?? 3600) * 1000);

  const meRes = await safeFetch(
    `https://graph.instagram.com/me?fields=user_id,username&access_token=${encodeURIComponent(token)}`,
    { accept: "application/json" },
  );
  const me = parseJson<{ user_id?: string; username?: string; id?: string }>(meRes);
  return { token, expiresAt, userId: String(me?.user_id ?? me?.id ?? short.user_id ?? ""), username: me?.username ?? null };
}
