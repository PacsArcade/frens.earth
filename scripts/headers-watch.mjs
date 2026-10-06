/**
 * Headers watch: fetches / from the local BUILT site and prints which
 * security response headers are present or missing. Every line starts with
 * WATCH:. It never fails the gate (the fix is a separate lane); flip
 * FAIL_ON_MISSING to true to make it fail later.
 *
 * Run from the repo root (after `next build`):  node scripts/headers-watch.mjs
 */

import { pathToFileURL } from "url";
import { siteFetch, makeChecker, runStandalone } from "./lib/local-site.mjs";

// One switch: true makes a missing header (or a present X-Powered-By) fail.
const FAIL_ON_MISSING = false;

const WANTED = [
  ["Content-Security-Policy", (h) => h.has("content-security-policy")],
  ["X-Content-Type-Options", (h) => h.has("x-content-type-options")],
  [
    "X-Frame-Options or frame-ancestors",
    (h) => h.has("x-frame-options") || /frame-ancestors/i.test(h.get("content-security-policy") ?? ""),
  ],
  ["Referrer-Policy", (h) => h.has("referrer-policy")],
  ["Permissions-Policy", (h) => h.has("permissions-policy")],
  ["Strict-Transport-Security", (h) => h.has("strict-transport-security")],
  ["X-Powered-By absent", (h) => !h.has("x-powered-by")],
];

export async function run(site) {
  const c = makeChecker("headers");
  const res = await siteFetch(site, "/");
  c.check(res.status < 500, `/ answered ${res.status}`);
  for (const [name, test] of WANTED) {
    const ok = test(res.headers);
    c.watch(`${name}: ${ok ? "ok" : "MISSING"}`);
    if (FAIL_ON_MISSING) c.check(ok, `${name} is missing`);
  }
  return c.state;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await runStandalone(run);
