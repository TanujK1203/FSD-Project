import { readFile } from "node:fs/promises";
import path from "node:path";
import { MEDIA_ROOT, contentTypeFor } from "@/server/media";

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (!parts.every((p) => /^[a-zA-Z0-9._-]+$/.test(p) && p !== ".." && p !== ".")) {
    return new Response("Not found", { status: 404 });
  }
  const full = path.join(MEDIA_ROOT, ...parts);
  if (!full.startsWith(MEDIA_ROOT + path.sep)) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(full);
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": contentTypeFor(full),
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
