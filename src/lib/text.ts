import { decodeHTML } from "entities";

export function slugify(input: string): string {
  return (
    input
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "item"
  );
}

export function randomSuffix(len = 5): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

const STOPWORDS = new Set([
  "a", "an", "and", "the", "for", "with", "of", "in", "on", "to", "by", "set", "pack", "new", "free", "size",
  "pcs", "piece", "pieces", "women", "men", "womens", "mens", "kids", "unisex",
]);

export function tokens(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Strip HTML tags into tidy plain text: one item per line, bullets kept, no runs of blank lines. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  const raw = html
    .replace(/<\s*(br|\/p|\/div|\/li|\/h\d|\/tr)\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z0-9#]+;/gi, (e) => decodeHTML(e))
    .replace(/\u00a0/g, " ");
  const lines: string[] = [];
  for (const line of raw.split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim())) {
    if (!line) continue;
    const last = lines[lines.length - 1];
    // a bullet whose text landed on the next line
    if (last === "•") lines[lines.length - 1] = `• ${line.replace(/^•\s*/, "")}`;
    else lines.push(line);
  }
  return lines
    .filter((l) => l !== "•")
    .join("\n")
    .slice(0, 5000);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
