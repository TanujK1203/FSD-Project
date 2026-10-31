/** Lowercased text used for LIKE search. */
export function buildSearchText(p: { title: string; tags?: string; category?: string; storeName?: string; description?: string }) {
  return [p.title, p.tags ?? "", p.category ?? "", p.storeName ?? "", (p.description ?? "").slice(0, 300)]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
