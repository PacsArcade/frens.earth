#!/usr/bin/env node
/**
 * check-npub-auth — plain-node assertions for the npub door (W10/N0).
 *
 * Exercises the REAL src/lib/fren-auth.ts (no copy-paste of the logic):
 * a tiny module.registerHooks resolver maps the repo's "@/..." alias and
 * extensionless relative imports onto the .ts files, and node's built-in
 * type stripping does the rest. No new dependencies.
 *
 * Run: node scripts/check-npub-auth.mjs   (green = every assert passed)
 */

import { registerHooks } from "node:module";
import { strict as assert } from "node:assert";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* the token HMAC needs a secret — in-process only, never a real one */
process.env.SEAT_SECRET = "check-npub-auth-test-secret";

registerHooks({
  resolve(specifier, context, nextResolve) {
    let s = specifier;
    if (s.startsWith("@/")) s = path.join(ROOT, "src", s.slice(2));
    if (s.startsWith("./") || s.startsWith("../") || path.isAbsolute(s)) {
      const base = s.startsWith(".")
        ? path.resolve(path.dirname(fileURLToPath(context.parentURL)), s)
        : s;
      if (!path.extname(base) && fs.existsSync(base + ".ts")) s = base + ".ts";
      else if (path.isAbsolute(base)) s = base;
    }
    return nextResolve(s, context);
  },
});

const { finalizeEvent, generateSecretKey, getPublicKey } = await import("nostr-tools/pure");
const { nip19 } = await import("nostr-tools");
const {
  verifyNpubLogin,
  makeFrenToken,
  sessionsFromRequest,
  frenFromRequest,
  isNpubDoor,
  NPUB_SPACE,
  FREN_COOKIE,
} = await import(path.join(ROOT, "src/lib/fren-auth.ts"));

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const sk = generateSecretKey();
const npub = nip19.npubEncode(getPublicKey(sk));

function loginEvent(overrides = {}) {
  const ts = overrides.challengeTs ?? Date.now();
  return finalizeEvent(
    {
      kind: overrides.kind ?? 22242,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: overrides.content ?? `PACS-LOGIN-${ts}`,
    },
    sk
  );
}

console.log("check-npub-auth — verifyNpubLogin");

check("fresh signed challenge → ok, npub derived from the event's pubkey", () => {
  const res = verifyNpubLogin(loginEvent());
  assert.equal(res.ok, true);
  assert.equal(res.npub, npub);
});

check("stale challenge (6 min old) → rejected", () => {
  const res = verifyNpubLogin(loginEvent({ challengeTs: Date.now() - 6 * 60 * 1000 }));
  assert.equal(res.ok, false);
  assert.match(res.reason, /expired/);
});

check("garbled content → rejected", () => {
  const res = verifyNpubLogin(loginEvent({ content: "PACS-LOGIN-yesterday-ish" }));
  assert.equal(res.ok, false);
  assert.match(res.reason, /not a login challenge/);
});

check("wrong kind (a plain note) → rejected", () => {
  const res = verifyNpubLogin(loginEvent({ kind: 1 }));
  assert.equal(res.ok, false);
  assert.match(res.reason, /not a login challenge/);
});

check("bad signature → rejected", () => {
  const ev = loginEvent();
  const flipped = ev.sig[0] === "0" ? "1" : "0";
  const res = verifyNpubLogin({ ...ev, sig: flipped + ev.sig.slice(1) });
  assert.equal(res.ok, false);
  assert.match(res.reason, /signature/);
});

check("missing pieces → rejected", () => {
  assert.equal(verifyNpubLogin({}).ok, false);
  const ev = loginEvent();
  assert.equal(verifyNpubLogin({ ...ev, sig: undefined }).ok, false);
});

console.log("check-npub-auth — npub token grammar");

check("isNpubDoor knows its one space", () => {
  assert.equal(isNpubDoor(NPUB_SPACE), true);
  assert.equal(isNpubDoor("frens"), false);
  assert.equal(isNpubDoor("pacsarcade"), false);
});

check("npub-door token round-trips through parseToken (via sessionsFromRequest)", () => {
  const token = makeFrenToken(npub, NPUB_SPACE);
  const req = new Request("http://local.test/", {
    headers: { cookie: `${FREN_COOKIE}=${token}` },
  });
  const sessions = sessionsFromRequest(req);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].handle, npub);
  assert.equal(sessions[0].space, NPUB_SPACE);
  const fren = frenFromRequest(req);
  assert.deepEqual(fren, { handle: npub, space: NPUB_SPACE });
});

check("tampered npub-door token → rejected", () => {
  const token = makeFrenToken(npub, NPUB_SPACE);
  const parts = token.split(".");
  const sig = parts[3];
  parts[3] = (sig[0] === "0" ? "1" : "0") + sig.slice(1);
  const req = new Request("http://local.test/", {
    headers: { cookie: `${FREN_COOKIE}=${parts.join(".")}` },
  });
  assert.equal(sessionsFromRequest(req).length, 0);
});

check("npub-door and tag tokens ride one cookie, first = active", () => {
  const cookie = [makeFrenToken(npub, NPUB_SPACE), makeFrenToken("alice", "frens")].join("~");
  const req = new Request("http://local.test/", {
    headers: { cookie: `${FREN_COOKIE}=${cookie}` },
  });
  const sessions = sessionsFromRequest(req);
  assert.equal(sessions.length, 2);
  assert.deepEqual(
    sessions.map((s) => s.space),
    [NPUB_SPACE, "frens"]
  );
});

console.log(`\nall green — ${passed} checks passed`);
