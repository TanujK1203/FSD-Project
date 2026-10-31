/** Only allow same-site relative redirects. */
export function safeNext(next: FormDataEntryValue | string | null | undefined, fallback = "/"): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : fallback;
}
