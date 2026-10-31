import { safeFetch } from "./safeFetch";

export type Robots = { allows: (path: string) => boolean; sitemaps: string[] };

type Rule = { allow: boolean; path: string };

/** Minimal robots.txt parser: groups for "*" (and our agent token), longest-match wins, supports * and $. */
export function parseRobots(text: string, agentToken = "haat-importer"): Robots {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim());
  const sitemaps: string[] = [];
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;

  for (const line of lines) {
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      if (key === "disallow" && value === "") continue;
      current.rules.push({ allow: key === "allow", path: value });
    }
  }

  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && agentToken.toLowerCase().includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  const rules = chosen.flatMap((g) => g.rules);

  const toRegex = (p: string) =>
    new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));

  return {
    sitemaps,
    allows(path: string) {
      let best: Rule | null = null;
      for (const r of rules) {
        if (toRegex(r.path).test(path)) {
          if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
        }
      }
      return best ? best.allow : true;
    },
  };
}

export async function loadRobots(origin: string): Promise<Robots> {
  try {
    const res = await safeFetch(`${origin}/robots.txt`, { accept: "text/plain", maxBytes: 512 * 1024 });
    if (res.status !== 200 || /<html/i.test(res.body.slice(0, 200))) return parseRobots("");
    return parseRobots(res.body);
  } catch {
    return parseRobots("");
  }
}
