import dns from "node:dns";
import net from "node:net";
import { Agent, EnvHttpProxyAgent, fetch as ufetch, type Dispatcher } from "undici";
import { IMPORT } from "@/config";

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

export class FetchFailedError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "FetchFailedError";
  }
}

function ipv4ToInt(ip: string) {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}

function inV4Range(ip: string, cidr: string) {
  const [range, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(range!) & mask);
}

const V4_BLOCKED = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
];

/** The IPv4 address in the last 32 bits, written either dotted ("1.2.3.4") or as two hex groups ("102:304"). */
function embeddedV4(tail: string): string | null {
  if (net.isIPv4(tail)) return tail;
  const m = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!m) return null;
  const hi = parseInt(m[1]!, 16);
  const lo = parseInt(m[2]!, 16);
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join(".");
}

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return V4_BLOCKED.some((c) => inV4Range(ip, c));
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    // IPv4-mapped (::ffff:a.b.c.d) and NAT64 (64:ff9b::a.b.c.d, used by IPv6-only networks such as
    // mobile hotspots) carry a real IPv4 address, so judge that address instead
    const wrapped = lower.match(/^(?:::ffff:|64:ff9b::)(.+)$/);
    if (wrapped) {
      const v4 = embeddedV4(wrapped[1]!);
      return v4 ? isPrivateIp(v4) : true;
    }
    if (lower === "::" || lower === "::1") return true;
    const first = parseInt(lower.split(":")[0] || "0", 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((first & 0xff00) === 0xff00) return true; // multicast
    if (lower.startsWith("64:ff9b:") || lower.startsWith("2001:db8:")) return true;
    return false;
  }
  return true;
}

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa"];

export async function assertPublicUrl(raw: string | URL): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError("That does not look like a web address");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new BlockedUrlError("Only http and https links work");
  if (url.username || url.password) throw new BlockedUrlError("Links with passwords are not allowed");
  if (url.port && !["80", "443", "8080", "8443"].includes(url.port)) throw new BlockedUrlError("Unusual port");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s)) || !host.includes(".") && !net.isIP(host)) {
    throw new BlockedUrlError("That address is not on the public internet");
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new BlockedUrlError("That address is not on the public internet");
    return url;
  }
  let addrs: dns.LookupAddress[];
  try {
    addrs = await dns.promises.lookup(host, { all: true });
  } catch {
    throw new FetchFailedError(`Could not find ${host}. Check the link for typos.`);
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw new BlockedUrlError("That address is not on the public internet");
  }
  return url;
}

// Validates the resolved address at connect time too, so DNS rebinding cannot slip through.
function safeLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void,
) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    const list = addresses as dns.LookupAddress[];
    const bad = list.find((a) => isPrivateIp(a.address));
    if (bad) return callback(new BlockedUrlError(`Blocked private address for ${hostname}`) as NodeJS.ErrnoException, "");
    if (options.all) return callback(null, list);
    const first = list[0];
    if (!first) return callback(new Error(`No address for ${hostname}`) as NodeJS.ErrnoException, "");
    callback(null, first.address, first.family);
  });
}

let dispatcher: Dispatcher | null = null;
function getDispatcher(): Dispatcher {
  if (dispatcher) return dispatcher;
  // In environments that route egress through a proxy, the proxy resolves hosts; we still pre-check each URL.
  dispatcher = process.env.HTTPS_PROXY || process.env.https_proxy
    ? new EnvHttpProxyAgent()
    : new Agent({ connect: { lookup: safeLookup as never }, headersTimeout: IMPORT.requestTimeoutMs });
  return dispatcher;
}

export type SafeResponse = {
  url: string;
  status: number;
  contentType: string;
  headers: Headers;
  body: string;
};

export async function safeFetch(
  input: string | URL,
  opts: { accept?: string; timeoutMs?: number; maxBytes?: number; method?: "GET" | "POST"; body?: string; headers?: Record<string, string> } = {},
): Promise<SafeResponse> {
  let current = await assertPublicUrl(input);
  const timeoutMs = opts.timeoutMs ?? IMPORT.requestTimeoutMs;
  const maxBytes = opts.maxBytes ?? IMPORT.maxResponseBytes;

  for (let hop = 0; hop < 6; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await ufetch(current, {
        method: opts.method ?? "GET",
        body: opts.body,
        redirect: "manual",
        signal: controller.signal,
        dispatcher: getDispatcher(),
        headers: {
          "user-agent": IMPORT.userAgent,
          accept: opts.accept ?? "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
          "accept-language": "en-IN,en;q=0.9",
          ...opts.headers,
        },
      });
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof BlockedUrlError) throw e;
      const cause = (e as { cause?: unknown }).cause;
      if (cause instanceof BlockedUrlError) throw cause;
      if ((e as Error).name === "AbortError") throw new FetchFailedError(`Timed out loading ${current.hostname}`);
      throw new FetchFailedError(`Could not reach ${current.hostname}`);
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      clearTimeout(timer);
      await res.body?.cancel();
      current = await assertPublicUrl(new URL(res.headers.get("location")!, current));
      continue;
    }

    try {
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) {
            await reader.cancel();
            throw new FetchFailedError("Response too large");
          }
          chunks.push(value);
        }
      }
      const body = Buffer.concat(chunks).toString("utf8");
      return {
        url: current.toString(),
        status: res.status,
        contentType: res.headers.get("content-type") ?? "",
        headers: res.headers as unknown as Headers,
        body,
      };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new FetchFailedError("Too many redirects");
}

/** Fetch binary content (images) with the same protections. */
export async function safeFetchBuffer(input: string | URL, maxBytes = 10 * 1024 * 1024) {
  let current = await assertPublicUrl(input);
  for (let hop = 0; hop < 6; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMPORT.requestTimeoutMs);
    try {
      const res = await ufetch(current, {
        redirect: "manual",
        signal: controller.signal,
        dispatcher: getDispatcher(),
        headers: { "user-agent": IMPORT.userAgent, accept: "image/*" },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        await res.body?.cancel();
        current = await assertPublicUrl(new URL(res.headers.get("location")!, current));
        continue;
      }
      if (!res.ok) throw new FetchFailedError(`HTTP ${res.status}`, res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > maxBytes) throw new FetchFailedError("Image too large");
      return { buffer: buf, contentType: res.headers.get("content-type") ?? "" };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new FetchFailedError("Too many redirects");
}

export function parseJson<T = unknown>(res: SafeResponse): T | null {
  if (res.status !== 200) return null;
  const text = res.body.trim();
  if (!text.startsWith("{") && !text.startsWith("[")) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Run fn over items with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET with a couple of retries on rate limits and server errors (stores often throttle bursts). */
export async function safeFetchRetry(input: string | URL, opts: Parameters<typeof safeFetch>[1] = {}, tries = 3): Promise<SafeResponse> {
  let last: SafeResponse | null = null;
  for (let i = 0; i < tries; i++) {
    try {
      last = await safeFetch(input, opts);
      if (last.status !== 429 && last.status < 500) return last;
      const retryAfter = Number(last.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 10) * 1000 : 1200 * (i + 1));
    } catch (e) {
      if (e instanceof BlockedUrlError || i === tries - 1) throw e;
      await sleep(1000 * (i + 1));
    }
  }
  return last!;
}
