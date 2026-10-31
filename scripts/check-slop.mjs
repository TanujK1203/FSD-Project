// Fails if common "AI-generated look" tells creep into the UI code. Run: npm run check:slop
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const RULES = [
  { re: /—/, why: "em dash in copy" },
  { re: /linear-gradient|radial-gradient|conic-gradient/, why: "gradient" },
  { re: /backdrop-filter/, why: "glassmorphism blur" },
  { re: /background-clip:\s*text/, why: "gradient text" },
  { re: /\bInter\b|Roboto/, why: "default font" },
  { re: /box-shadow:\s*0 0 \d+px/, why: "glow shadow" },
  { re: /border-left:\s*[2-9]px solid/, why: "side-stripe border" },
  { re: /cubic-bezier\([^)]*1\.[2-9]/, why: "bounce easing" },
  { re: /transition:\s*all/, why: "transition: all" },
  { re: /#000\b|#000000|#fff\b|#ffffff/i, why: "pure black/white (use tokens)" },
  { re: /\b(seamless(ly)?|supercharge|elevate your|unleash|empower|world-class|revolutioni[sz]e|effortless(ly)?)\b/i, why: "buzzword copy" },
];

const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(f)) files.push(p);
  }
})("src");

let problems = 0;
for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const r of RULES) {
      if (r.re.test(line)) {
        problems++;
        console.log(`${file}:${i + 1}  ${r.why}\n    ${line.trim().slice(0, 120)}`);
      }
    }
  });
}
console.log(problems ? `\n${problems} problem(s)` : `No slop tells found in ${files.length} files.`);
process.exitCode = problems ? 1 : 0;
