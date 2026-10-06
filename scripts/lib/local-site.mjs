/**
 * Local site helper for the test gate: starts the BUILT site (`next start`)
 * on a free 127.0.0.1 port and stops it again. Used by the live tests
 * (door-sweep, sign-in-abuse, headers-watch) and by scripts/gate-live.mjs.
 *
 * House rules this file keeps:
 *  - The operator key is a throwaway made in memory with nostr-tools. It is
 *    never written to disk and never printed. Its npub goes to the server as
 *    OPERATOR_NPUBS, beside a random SEAT_SECRET.
 *  - The server gets a SCRUBBED environment: PATH, HOME, NODE_ENV, PORT, the
 *    two values above, and the NEXT_PUBLIC_ names the site needs to boot
 *    (read from .env.example). No token from the shell reaches it.
 *  - Hard time limit on the server, killed by pid when done.
 *  - Only 127.0.0.1 / localhost is ever a target (siteFetch refuses the rest).
 *  - Data stores: the site writes under process.cwd()/data and public/ with
 *    no path override, so the tests only send requests that cannot write
 *    (refusals, GETs, rejected sign-ins). The gate checks the tree stays clean.
 *
 * Requires `next build` to have run first.
 */

import path from "path";
import net from "net";
import crypto from "crypto";
import { spawn } from "child_process";
import { readFile, access } from "fs/promises";
import { generateSecretKey, getPublicKey, finalizeEvent, nip19 } from "nostr-tools";

const root = path.resolve(new URL("../..", import.meta.url).pathname);

// Longest the server may live, whatever the tests do.
export const SERVER_MAX_MS = 15 * 60 * 1000;
const BOOT_WAIT_MS = 90 * 1000;

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

export function assertLocal(url) {
  const host = new URL(url).hostname;
  if (!LOCAL_HOSTS.has(host)) throw new Error(`refusing non-local host: ${host}`);
}

/** fetch that only ever talks to this machine. Never follows redirects. */
export async function siteFetch(site, pathname, init = {}) {
  const url = new URL(pathname, site.base).toString();
  assertLocal(url);
  return fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30000), ...init });
}

/** The NEXT_PUBLIC_ names the site needs to boot, from .env.example only. */
async function publicEnv() {
  const wanted = ["NEXT_PUBLIC_SPACE_NAME", "NEXT_PUBLIC_NIP05_DOMAIN"];
  const out = {};
  const text = await readFile(path.join(root, ".env.example"), "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && wanted.includes(m[1]) && m[2].trim()) out[m[1]] = m[2].trim();
  }
  return out;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** Sign a login event with the throwaway key (or any key you pass). */
export function signLogin(secretKey, { kind = 22242, content, created_at } = {}) {
  return finalizeEvent(
    {
      kind,
      created_at: created_at ?? Math.floor(Date.now() / 1000),
      tags: [],
      content: content ?? `PACS-CONSOLE-${Date.now()}`,
    },
    secretKey
  );
}

export { generateSecretKey, getPublicKey, nip19 };

/** Pull `name=value` out of a Set-Cookie header list; value is never printed. */
export function cookieFrom(res, name) {
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const m = line.match(new RegExp(`^${name}=([^;]*)`));
    if (m) return { value: m[1], raw: line };
  }
  return null;
}

export async function startLocalSite() {
  try {
    await access(path.join(root, ".next", "BUILD_ID"));
  } catch {
    throw new Error("no build found: run `npx next build` first");
  }
  const port = await freePort();
  const operatorKey = generateSecretKey();
  const operatorNpub = nip19.npubEncode(getPublicKey(operatorKey));
  const env = {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    NODE_ENV: "production",
    PORT: String(port),
    OPERATOR_NPUBS: operatorNpub,
    SEAT_SECRET: crypto.randomBytes(32).toString("hex"),
    ...(await publicEnv()),
  };
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let tail = "";
  const keep = (b) => {
    tail = (tail + b.toString()).slice(-2000);
  };
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);
  let exited = false;
  child.on("exit", () => {
    exited = true;
  });
  const timer = setTimeout(() => child.kill("SIGKILL"), SERVER_MAX_MS);
  timer.unref();

  const site = {
    base: `http://127.0.0.1:${port}`,
    port,
    operatorKey,
    operatorNpub,
    pid: child.pid,
    async stop() {
      clearTimeout(timer);
      if (exited) return;
      child.kill("SIGTERM");
      const t = setTimeout(() => child.kill("SIGKILL"), 4000);
      await new Promise((r) => child.once("exit", r));
      clearTimeout(t);
    },
  };

  const t0 = Date.now();
  for (;;) {
    if (exited) throw new Error(`site exited while booting:\n${tail}`);
    try {
      await siteFetch(site, "/");
      return site;
    } catch {
      if (Date.now() - t0 > BOOT_WAIT_MS) {
        await site.stop();
        throw new Error(`site did not answer within ${BOOT_WAIT_MS / 1000}s:\n${tail}`);
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  }
}

/** Tiny result counter in the house "N passed, N failed" style. */
export function makeChecker(label) {
  const state = { passed: 0, failed: 0, watches: [], failures: [] };
  return {
    state,
    pass() {
      state.passed++;
    },
    fail(msg) {
      state.failed++;
      state.failures.push(msg);
      console.error(`FAIL ${label}: ${msg}`);
    },
    check(ok, msg) {
      if (ok) state.passed++;
      else this.fail(msg);
    },
    /** A check that is known to be open: it never fails the gate. */
    knownOpen(ok, msg, note) {
      if (ok) {
        state.watches.push(`WATCH: ${label}: KNOWN OPEN now passes, remove it from the list: ${msg}`);
        state.passed++;
      } else {
        state.watches.push(`WATCH: ${label}: KNOWN OPEN: ${msg} (${note})`);
      }
    },
    watch(msg) {
      state.watches.push(`WATCH: ${label}: ${msg}`);
    },
  };
}

/** Run a test module's run(site) on its own site when executed directly. */
export async function runStandalone(run) {
  const site = await startLocalSite();
  let res;
  try {
    res = await run(site);
  } finally {
    await site.stop();
  }
  for (const w of res.watches) console.log(w);
  console.log(`${res.passed} passed, ${res.failed} failed`);
  process.exit(res.failed ? 1 : 0);
}
