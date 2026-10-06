/**
 * Door sweep: every admin API route must refuse a visitor BEFORE it does
 * anything. Two parts.
 *
 * Static (no server):  node scripts/door-sweep.test.mjs --static
 *   Walks src/app/api/admin/** /route.ts, lists every exported HTTP method,
 *   and fails when a method does not call the operator guard from
 *   src/lib/operator-auth.ts (operatorFromCookieHeader / verifyOperatorToken),
 *   either directly or through a helper function in the same file that does,
 *   and before the handler's first await. New routes are picked up from the
 *   file tree with no edit here.
 *
 * Live (needs `next build`):  node scripts/door-sweep.test.mjs
 *   Starts the built site on a local port and calls every admin route and
 *   method with (a) no cookie, (b) a garbage fe-operator cookie, (c) a
 *   well-shaped but wrongly signed token. All must answer 401 or 403.
 *   Positive control: signs in as the throwaway operator and calls GET routes
 *   ONLY with that session. A valid session is never sent with POST, PUT,
 *   PATCH or DELETE: some admin routes deploy, merge or commit.
 *
 * Result line: "N passed, N failed".
 * gate:live (the gate runs the live part itself, from scripts/gate-live.mjs)
 */

import path from "path";
import { readdir, readFile } from "fs/promises";
import { pathToFileURL } from "url";
import {
  siteFetch,
  signLogin,
  cookieFrom,
  makeChecker,
  runStandalone,
} from "./lib/local-site.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const adminDir = path.join(root, "src", "app", "api", "admin");
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const GUARDS = ["operatorFromCookieHeader", "verifyOperatorToken"];

// route (under /api/admin/) -> methods allowed to answer without a guard
const ALLOWED_OPEN = {
  // the sign-in door itself: POST takes a signed challenge, checked by
  // verifyOperatorLogin (see sign-in-abuse.test.mjs). GET only reports who you are.
  session: { methods: ["POST"], reason: "this IS the sign-in route" },
};

// Routes whose GET reaches OUT to another host when signed in (mempool.space,
// GitHub, ...). The gate is local-only, so the positive control skips them.
const POSITIVE_SKIP = {
  "mempool/status": "GET fetches the configured chain node (default mempool.space)",
  "chat/status": "GET fetches the configured chat floor",
  merges: "GET lists open pull requests on GitHub",
  rank: "GET reads the chain tip from mempool.space",
};

// KNOWN OPEN: route@METHOD -> one-line note. Never weaken a check, list it.
// (a key ending in |json marks the JSON-body probe of a route that also takes multipart)
const KNOWN_OPEN = {
  "store/upload-deliverable@POST|json":
    "JSON branch is gated inside Vercel's handleUpload callback: a refused probe answers 400, not 401, and nothing is minted; the multipart branch is guarded directly and is checked below",
};

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (e.name === "route.ts") out.push(full);
  }
  return out;
}

/** Split a route source into its exported handlers: { method, body }. */
function handlers(src) {
  const re =
    /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b|export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;
  const hits = [...src.matchAll(re)];
  return hits.map((m, i) => ({
    method: m[1] ?? m[2],
    body: src.slice(m.index, i + 1 < hits.length ? hits[i + 1].index : src.length),
  }));
}

/** Names of local functions in this file whose body calls a guard. */
function guardHelpers(src) {
  const names = [];
  const re = /(?:async\s+)?function\s+(\w+)\s*\([^)]*\)[^{]*\{/g;
  let m;
  while ((m = re.exec(src))) {
    if (METHODS.includes(m[1])) continue;
    const body = src.slice(m.index, m.index + 600);
    if (GUARDS.some((g) => body.includes(`${g}(`))) names.push(m[1]);
  }
  return names;
}

function routeName(file) {
  return path.relative(adminDir, path.dirname(file)).split(path.sep).join("/");
}

export async function collectRoutes() {
  const routes = [];
  for (const file of (await walk(adminDir)).sort()) {
    const src = await readFile(file, "utf8");
    routes.push({
      name: routeName(file),
      rel: path.relative(root, file).split(path.sep).join("/"),
      src,
      handlers: handlers(src),
    });
  }
  return routes;
}

function staticPart(c, routes) {
  for (const r of routes) {
    c.check(r.handlers.length > 0, `${r.rel}: exports no HTTP method`);
    const importsGuard = GUARDS.some((g) => r.src.includes(g));
    const helpers = guardHelpers(r.src);
    for (const h of r.handlers) {
      const id = `${r.name}@${h.method}`;
      if (ALLOWED_OPEN[r.name]?.methods.includes(h.method)) continue;
      const calls = [...GUARDS.map((g) => `${g}(`), ...helpers.map((n) => `${n}(`)];
      const first = Math.min(...calls.map((s) => h.body.indexOf(s)).filter((i) => i >= 0));
      const guarded = Number.isFinite(first);
      const awaitAt = h.body.indexOf("await ");
      const early = guarded && (awaitAt < 0 || first < awaitAt);
      const ok = importsGuard && guarded && early;
      const why = !importsGuard
        ? "file never uses the operator guard"
        : !guarded
          ? "handler does not call the operator guard"
          : "guard runs after the first await";
      if (KNOWN_OPEN[id]) c.knownOpen(ok, `${r.rel} ${h.method}: ${why}`, KNOWN_OPEN[id]);
      else c.check(ok, `${r.rel} ${h.method}: ${why}`);
    }
  }
}

const refused = (s) => s === 401 || s === 403;

async function livePart(c, routes, site) {
  const wrongToken = `${"ab".repeat(32)}.${Date.now() + 86400000}.${"cd".repeat(32)}`;
  const variants = [
    ["no cookie", {}],
    ["garbage cookie", { cookie: "fe-operator=not-a-token" }],
    ["wrongly signed token", { cookie: `fe-operator=${wrongToken}` }],
  ];
  const urlOf = (name) => `/api/admin/${name.replace(/\[[^\]]+\]/g, "x")}`;

  for (const r of routes) {
    for (const h of r.handlers) {
      if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(h.method)) continue;
      const id = `${r.name}@${h.method}`;
      if (ALLOWED_OPEN[r.name]?.methods.includes(h.method)) continue;
      const multipart = h.method === "POST" && r.src.includes("multipart/form-data");
      for (const [label, headers] of variants) {
        const hasBody = h.method !== "GET";
        const probes = [{ tag: multipart ? "|json" : "", form: false }];
        if (multipart) probes.push({ tag: "|multipart", form: true });
        for (const probe of probes) {
          let body;
          const hdrs = { ...headers };
          if (probe.form) {
            body = new FormData();
            body.append("file", new Blob(["x"], { type: "application/pdf" }), "x.pdf");
          } else if (hasBody) {
            hdrs["content-type"] = "application/json";
            body = "{}";
          }
          const res = await siteFetch(site, urlOf(r.name), { method: h.method, headers: hdrs, body });
          const ok = refused(res.status);
          const msg = `${id}${probe.tag} with ${label} answered ${res.status}, wanted 401 or 403`;
          if (KNOWN_OPEN[id + probe.tag]) c.knownOpen(ok, msg, KNOWN_OPEN[id + probe.tag]);
          else c.check(ok, msg);
        }
      }
    }
  }

  // Positive control: the real sign-in, then GET routes only.
  const login = await siteFetch(site, "/api/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event: signLogin(site.operatorKey) }),
  });
  const cookie = cookieFrom(login, "fe-operator");
  c.check(login.status === 200 && !!cookie, `throwaway operator could not sign in (status ${login.status})`);
  if (!cookie) return;
  const session = { cookie: `fe-operator=${cookie.value}` };
  const me = await siteFetch(site, "/api/admin/session", { headers: session });
  c.check(me.status === 200, `session GET with a good session answered ${me.status}`);
  for (const r of routes) {
    if (!r.handlers.some((h) => h.method === "GET")) continue;
    if (r.name === "session") continue;
    if (POSITIVE_SKIP[r.name]) continue;
    const res = await siteFetch(site, urlOf(r.name), { headers: session });
    c.check(!refused(res.status), `${r.name}@GET refused a valid operator session (${res.status})`);
    c.check(res.status < 500, `${r.name}@GET answered ${res.status} for a valid operator session`);
  }
}

export async function run(site) {
  const c = makeChecker("door-sweep");
  const routes = await collectRoutes();
  c.check(routes.length > 0, "no admin routes found");
  staticPart(c, routes);
  if (site) await livePart(c, routes, site);
  return c.state;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--static")) {
    const res = await run(null);
    for (const w of res.watches) console.log(w);
    console.log(`${res.passed} passed, ${res.failed} failed`);
    process.exit(res.failed ? 1 : 0);
  } else {
    await runStandalone(run);
  }
}
