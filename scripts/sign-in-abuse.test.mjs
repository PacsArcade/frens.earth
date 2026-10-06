/**
 * Sign-in abuse check: throws bad login attempts at /api/admin/session and
 * /api/frens/session on a local copy of the BUILT site and requires a clean
 * 4xx every time (never a 500, never a session). Also checks the success
 * cookie carries HttpOnly, Secure and SameSite, and RECORDS what a replayed
 * event does as a WATCH line (it never fails on that; the owner rules on it).
 *
 * Only requests that cannot write are sent: rejected sign-ins, plus one
 * accepted operator sign-in (it sets a cookie and writes nothing).
 * The fren door has no registered key on a fresh site, so its success path
 * is not exercised here.
 *
 * Run from the repo root (after `next build`):  node scripts/sign-in-abuse.test.mjs
 * Result line: "N passed, N failed".
 * gate:live (the gate runs the live part itself, from scripts/gate-live.mjs)
 */

import { pathToFileURL } from "url";
import {
  siteFetch,
  signLogin,
  cookieFrom,
  generateSecretKey,
  makeChecker,
  runStandalone,
} from "./lib/local-site.mjs";

// KNOWN OPEN: check label -> one-line note. Never weaken a check, list it.
const KNOWN_OPEN = {
  "admin: wrong event kind": "verifyOperatorLogin never checks event.kind; the 22242 contract is comment-only",
};

const post = (site, route, body, raw = false) =>
  siteFetch(site, route, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ? body : JSON.stringify(body),
  });

const clean4xx = (s) => s >= 400 && s < 500;

function cases(door, challenge, signerKey, strangerKey) {
  const now = () => Date.now();
  const tag = (s) => `${challenge}${s}`;
  const fresh = () => signLogin(signerKey, { content: tag(now()) });
  const tampered = (e, patch) => ({ ...e, ...patch });
  const flip = (hex) => (hex[0] === "a" ? "b" : "a") + hex.slice(1);
  const list = [];
  list.push([`${door}: wrong event kind`, () => ({ event: signLogin(signerKey, { kind: 1, content: tag(now()) }) })]);
  list.push([`${door}: stale challenge`, () => ({ event: signLogin(signerKey, { content: tag(now() - 10 * 60 * 1000) }) })]);
  list.push([`${door}: challenge dated in the future`, () => ({ event: signLogin(signerKey, { content: tag(now() + 10 * 60 * 1000) }) })]);
  list.push([`${door}: tampered signature`, () => {
    const e = fresh();
    return { event: tampered(e, { sig: flip(e.sig) }) };
  }]);
  list.push([`${door}: tampered content after signing`, () => {
    const e = fresh();
    return { event: tampered(e, { content: tag(now() + 1) }) };
  }]);
  list.push([`${door}: valid signature from a key not on the list`, () => ({
    event: signLogin(strangerKey, { content: tag(now()) }),
  })]);
  list.push([`${door}: missing event`, () => ({})]);
  list.push([`${door}: event is not an object`, () => ({ event: "PACS" })]);
  return list;
}

export async function run(site) {
  const c = makeChecker("sign-in-abuse");
  const stranger = generateSecretKey();
  const doors = [
    ["admin", "/api/admin/session", "PACS-CONSOLE-", site.operatorKey],
    ["frens", "/api/frens/session", "PACS-LOGIN-", stranger],
  ];

  for (const [door, route, challenge, signer] of doors) {
    for (const [label, build] of cases(door, challenge, signer, stranger)) {
      const res = await post(site, route, build());
      const ok = clean4xx(res.status) && !cookieFrom(res, door === "admin" ? "fe-operator" : "pa-fren");
      const msg = `${label}: answered ${res.status}, wanted a clean 4xx and no cookie`;
      if (KNOWN_OPEN[label]) c.knownOpen(ok, msg, KNOWN_OPEN[label]);
      else c.check(ok, msg);
    }
    const nonJson = await post(site, route, "this is not json", true);
    c.check(clean4xx(nonJson.status), `${door}: non-JSON body answered ${nonJson.status}, wanted a clean 4xx`);
    const huge = await post(site, route, JSON.stringify({ event: { content: "A".repeat(3 * 1024 * 1024) } }), true);
    c.check(clean4xx(huge.status), `${door}: oversized body answered ${huge.status}, wanted a clean 4xx`);
    const empty = await post(site, route, "", true);
    c.check(clean4xx(empty.status), `${door}: empty body answered ${empty.status}, wanted a clean 4xx`);
  }

  // Success path and cookie flags (operator door).
  const event = signLogin(site.operatorKey);
  const ok = await post(site, "/api/admin/session", { event });
  c.check(ok.status === 200, `admin: a good sign-in answered ${ok.status}, wanted 200`);
  const cookie = cookieFrom(ok, "fe-operator");
  c.check(!!cookie, "admin: a good sign-in set no fe-operator cookie");
  if (cookie) {
    for (const flag of ["HttpOnly", "Secure", "SameSite"]) {
      c.check(new RegExp(`;\\s*${flag}\\b`, "i").test(cookie.raw), `admin: session cookie is missing ${flag}`);
    }
  }

  // Replay: the same accepted event a second time. Recorded, never failed.
  const replay = await post(site, "/api/admin/session", { event });
  c.watch(
    replay.status === 200
      ? "an accepted admin sign-in event can be replayed inside its 5 minute window (second send answered 200)"
      : `a replayed admin sign-in event was refused (second send answered ${replay.status})`
  );
  return c.state;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await runStandalone(run);
