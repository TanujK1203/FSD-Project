import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { safeFetchBuffer } from "./import/safeFetch";

export const MEDIA_ROOT = path.join(process.cwd(), "storage", "media");

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function sniff(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "image/png";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.subarray(0, 3).toString() === "GIF") return "image/gif";
  if (buf.subarray(4, 12).toString().startsWith("ftypavif")) return "image/avif";
  return null;
}

async function store(storeId: string, name: string, buf: Buffer, type: string) {
  const ext = TYPES[type];
  if (!ext) throw new Error("Unsupported image type");
  const safeStore = storeId.replace(/[^a-z0-9]/gi, "");
  const dir = path.join(MEDIA_ROOT, safeStore);
  await mkdir(dir, { recursive: true });
  const file = `${name}.${ext}`;
  await writeFile(path.join(dir, file), buf);
  return `/media/${safeStore}/${file}`;
}

/** Download a remote image (e.g. an Instagram CDN URL that expires) into local storage. */
export async function saveRemoteImage(url: string, storeId: string): Promise<string> {
  const { buffer } = await safeFetchBuffer(url);
  const type = sniff(buffer);
  if (!type) throw new Error("Not an image");
  const name = createHash("sha1").update(url.split("?")[0]!).digest("hex").slice(0, 20);
  return store(storeId, name, buffer, type);
}

/** Save an image the seller uploaded. Type is checked from the bytes, not the file name. */
export async function saveUploadedImage(file: File, storeId: string): Promise<string> {
  if (file.size > 8 * 1024 * 1024) throw new Error("Images must be under 8 MB");
  const buffer = Buffer.from(await file.arrayBuffer());
  const type = sniff(buffer);
  if (!type) throw new Error("Upload a JPG, PNG or WebP image");
  return store(storeId, randomBytes(10).toString("hex"), buffer, type);
}

export function contentTypeFor(file: string): string {
  const ext = path.extname(file).slice(1).toLowerCase();
  return Object.entries(TYPES).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
}
