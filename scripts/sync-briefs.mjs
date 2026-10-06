/**
 * Sync design briefs INTO the private store — a SECONDARY, dev-only convenience.
 *
 * The PRIMARY path is the SCAR console's "⟳ Pull briefs" button on /a/briefs,
 * which pulls a private captains-only GitHub repo via the console's connected
 * token. This script does the same from a LOCAL sibling folder, for an operator
 * working offline / before the repo is wired.
 *
 * ── PRIVACY (the hard rule) ──────────────────────────────────────────────────
 * This repo is PUBLIC and the briefs are internal strategy, so their CONTENT is
 * NEVER committed. This script reads the operator's local briefs and writes them
 * into the GITIGNORED data/briefs/ dir (dev). Nothing it writes is tracked by
 * git. A deployed site takes its briefs from the console pull instead.
 *
 * Source (first match wins):
 *   1. --dir <path>           (explicit)
 *   2. $BRIEFS_DIR            (env)
 *   3. a `design-briefs` folder found walking up from this repo — i.e.
 *      C:\dev\pacsarcade\design-briefs when the repo is C:\dev\pacsarcade\frens.earth
 *
 * Target: data/briefs/<slug>.json   (gitignored)
 *
 * Usage:  npm run sync:briefs [-- --dir <path-to-briefs>]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function findBriefsDir() {
  const dirArg = process.argv.indexOf("--dir");
  if (dirArg > -1 && process.argv[dirArg + 1]) return resolve(process.argv[dirArg + 1]);
  if (process.env.BRIEFS_DIR?.trim()) return resolve(process.env.BRIEFS_DIR.trim());
  // walk up from the repo looking for a sibling `design-briefs` folder
  let cur = root;
  for (let i = 0; i < 8; i++) {
    const candidate = join(cur, "design-briefs");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return null;
}

/** Filename/path → slug. MUST match briefSlug() in src/lib/briefs.ts. */
function briefSlug(raw) {
  return raw
    .replace(/\.md$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Split a markdown doc into title + body. MUST match parseBrief() in briefs.ts. */
function parseBrief(markdown, filename) {
  const text = markdown.replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  let title = "";
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "") continue;
    const m = lines[i].match(/^#\s+(.+?)\s*#*\s*$/);
    if (m) {
      title = m[1].trim();
      bodyStart = i + 1;
    }
    break;
  }
  if (!title) {
    title = filename
      .replace(/\.md$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const body = lines.slice(bodyStart).join("\n").replace(/^\n+/, "").trimEnd();
  return { title, body };
}

const briefsDir = findBriefsDir();
if (!briefsDir || !existsSync(briefsDir)) {
  console.error(
    `[sync-briefs] no briefs folder found. Pass one:  npm run sync:briefs -- --dir <path>\n` +
      `[sync-briefs]   (looked for a sibling 'design-briefs' folder up from ${root})`,
  );
  process.exit(1);
}

const files = readdirSync(briefsDir).filter((f) => f.toLowerCase().endsWith(".md"));
if (files.length === 0) {
  console.error(`[sync-briefs] ${briefsDir} has no *.md briefs — nothing to sync.`);
  process.exit(1);
}

if (process.env.REGISTRY_DRIVER === "blob") {
  console.error("[sync-briefs] this script writes local files only; a deployed site pulls its briefs from the console.");
  process.exit(1);
}

const dataDir = join(root, "data", "briefs");
mkdirSync(dataDir, { recursive: true });

let n = 0;
for (const file of files) {
  const slug = briefSlug(file);
  if (!slug) continue;
  const raw = readFileSync(join(briefsDir, file), "utf8");
  const { title, body } = parseBrief(raw, basename(file));
  // local sibling folder = the PERSONAL (private) tier — the shared tier is
  // pulled from a public repo via the console, never synced from a local dir.
  const record = { slug, title, body, source: file, tier: "personal" };
  const json = JSON.stringify(record, null, 2);
  writeFileSync(join(dataDir, `${slug}.json`), json);
  n++;
}

console.log(
  `[sync-briefs] wrote ${n} brief${n === 1 ? "" : "s"} from ${briefsDir} → ` +
    `${dataDir} (gitignored — never committed)`,
);
