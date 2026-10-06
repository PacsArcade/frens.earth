/**
 * Own-doors check (owner ruling, block 970,133): everything on frens.earth
 * stays on frens.earth. The ONE link to Pac's Arcade is the credit line in
 * the bottom footer (src/components/EarthFooter.tsx).
 *
 * Reads every .ts / .tsx file under src/ and fails when a pacsarcade.org
 * address appears in code outside the allow list below. Comments are
 * skipped: the house history may name the arcade, a door may not open on it.
 *
 * Run from the repo root:  node scripts/own-doors.test.mjs
 */

import path from "path";
import { readdir, readFile } from "fs/promises";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const srcDir = path.join(root, "src");

// Any pacsarcade.org address with a scheme, sub-domains included.
const ARCADE_URL = /https?:\/\/(?:[a-z0-9-]+\.)*pacsarcade\.org[^\s"'`)]*/gi;

// file (relative to the repo root) -> the addresses it may carry
const ALLOWED = {
  // the footer credit: the only arcade link a visitor can press
  "src/components/EarthFooter.tsx": [/^https:\/\/pacsarcade\.org$/],
  // a data read, not a link: the orrery's second source for the chain tip
  "src/components/time/orrery/orrery-engine.ts": [/^https:\/\/time\.pacsarcade\.org\/api\//],
};

const isComment = (line) => /^\s*(\*|\/\/|\/\*|\{\/\*)/.test(line);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const found = [];
for (const file of await walk(srcDir)) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  const allowed = ALLOWED[rel] ?? [];
  const lines = (await readFile(file, "utf8")).split("\n");
  lines.forEach((line, i) => {
    if (isComment(line)) return;
    for (const url of line.match(ARCADE_URL) ?? []) {
      if (allowed.some((ok) => ok.test(url))) continue;
      found.push(`${rel}:${i + 1}  ${url}`);
    }
  });
}

if (found.length) {
  console.error(`own-doors: ${found.length} arcade address(es) outside the footer:`);
  for (const f of found) console.error(`  ${f}`);
  process.exit(1);
}
console.log("own-doors: PASS (the footer credit is the only arcade link)");
