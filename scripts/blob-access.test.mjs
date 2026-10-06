/**
 * Blob-access check: operator documents live in the private store
 * (src/lib/private-store.ts), never in blob storage. The only code that may
 * ask for blob access of the "public" kind is the name registry (served to
 * the world by design) and the product / member image uploads.
 *
 * Reads every .ts / .tsx file under src/ and every .mjs under scripts/ (the
 * test files themselves excepted) and fails when such a request appears in
 * a file outside the allow list. Comment lines are skipped. The private store
 * module may only READ older copies: it must never import or call put().
 *
 * Run from the repo root:  node scripts/blob-access.test.mjs
 */

import path from "path";
import { readdir, readFile } from "fs/promises";

const root = path.resolve(new URL("..", import.meta.url).pathname);

const PUBLIC_ACCESS = /access\s*:\s*["'`]public["'`]/;

// file (relative to the repo root) -> why it may ask
const ALLOWED = {
  "src/lib/registry.ts": "the name registry, served to the world by design",
  "src/app/api/admin/store/upload/route.ts": "product image uploads",
  "src/app/a/store/page.tsx": "product image uploads (browser side)",
  "src/app/api/frens/upload/route.ts": "member image uploads",
  "src/lib/private-store.ts": "read-only access to older copies (checked below: no put)",
};
const READ_ONLY = new Set(["src/lib/private-store.ts"]);

const isComment = (line) => /^\s*(\*|\/\/|\/\*|\{\/\*)/.test(line);

async function walk(dir, exts) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, exts)));
    else if (exts.test(entry.name) && !/\.test\.mjs$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = [...(await walk(path.join(root, "src"), /\.(ts|tsx)$/)), ...(await walk(path.join(root, "scripts"), /\.mjs$/))];

const problems = [];
let seen = 0;
for (const file of files) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  const lines = (await readFile(file, "utf8")).split("\n");
  lines.forEach((line, i) => {
    if (isComment(line) || !PUBLIC_ACCESS.test(line)) return;
    seen++;
    if (!(rel in ALLOWED)) problems.push(`${rel}:${i + 1}  blob access outside the allow list`);
    else if (READ_ONLY.has(rel) && /put\s*\(/.test(line)) problems.push(`${rel}:${i + 1}  write in a read-only file`);
  });
  if (READ_ONLY.has(rel)) {
    const code = lines.filter((l) => !isComment(l)).join("\n");
    if (/\bput\b[^\n]*from\s+["']@vercel\/blob|import\s*\{[^}]*\bput\b[^}]*\}\s*from\s*["']@vercel\/blob|\bput\s*\(/.test(code)) {
      problems.push(`${rel}  imports or calls put(); it may only read`);
    }
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`blob-access: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`blob-access: ok (${files.length} files, ${seen} allowed uses)`);
