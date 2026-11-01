/**
 * Registry index + sub-name checks. Offline: @vercel/blob is swapped for an
 * in-memory fake that models a stale CDN copy.
 * Run from the repo root:  node scripts/subname-index.test.mjs
 */
import path from "path";
import { pathToFileURL } from "url";
import { registerHooks } from "node:module";
import { resolve as resolveTsLoose } from "./lib/ts-loose-resolve.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const fakeUrl = pathToFileURL(path.join(root, "scripts", "lib", "fake-blob.mjs")).href;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "@vercel/blob") return { url: fakeUrl, shortCircuit: true };
    return resolveTsLoose(spec, ctx, next);
  },
});

process.env.BLOB_READ_WRITE_TOKEN = "test-token";
process.env.REGISTRY_DRIVER = "blob";
delete process.env.VERCEL;
delete process.env.FRENS_SUBNAME_SECRET_VEND;

const fake = await import(fakeUrl);
const reg = await import(path.join(root, "src", "lib", "registry.ts"));
const api = await import(path.join(root, "src", "lib", "subname-api.ts"));

let passed = 0, failed = 0;
function t(name, cond, extra = "") {
  if (cond) passed++;
  else { failed++; console.log(`FAIL  ${name}${extra ? ` - ${extra}` : ""}`); }
}

const NPUB_A = "npub1wmgw8yx4kly7rh3uhdar52g8dqgmhceck9tnwwy0vy2twwc5eq9sfcrex3";
const NPUB_B = "npub1pshdl9hs9663wyau2xzd4vcrtdzq30dux3hcg0u6g2ypt9ekxatszskujg";
const S = "frens";
const idxPath = `registry/${S}/_index.json`;
const recPath = (h) => `registry/${S}/${h}.json`;

// ---- (a)(b) format -----------------------------------------------------------
t("vend is reserved", !reg.validateHandle("vend").ok);
t("public queue refuses dotted", !reg.validateHandle("maria.vend").ok);
t("public queue refuses dotted, other parent", !reg.validateHandle("maria.pac").ok);
t("subname ok", reg.checkSubnameFormat("maria.vend").ok);
t("subname long total ok", reg.checkSubnameFormat("a-very-long-name-20c.vend").ok);
t("subname unknown parent refused", !reg.checkSubnameFormat("maria.other").ok);
t("subname two levels refused", !reg.checkSubnameFormat("a.maria.vend").ok);
t("subname short name refused", !reg.checkSubnameFormat("ab.vend").ok);
t("subname 21 char name refused", !reg.checkSubnameFormat("abcdefghijklmnopqrstu.vend").ok);
t("subname bad chars refused", !reg.checkSubnameFormat("ma_ria.vend").ok);

// ---- seating ------------------------------------------------------------------
fake.reset();
let r = await reg.seatReservedHandle({ handle: "maria.vend", npub: NPUB_A, space: S });
t("subname refused while parent not seated", !r.ok && /parent/.test(r.reason), JSON.stringify(r));
r = await reg.seatReservedHandle({ handle: "vend", npub: NPUB_A, space: S });
t("operator seats vend", r.ok);
r = await reg.seatReservedHandle({ handle: "maria.vend", npub: NPUB_B, space: S });
t("operator seats maria.vend", r.ok);
r = await reg.seatReservedHandle({ handle: "maria.vend", npub: NPUB_A, space: S });
t("seating never overwrites", !r.ok && r.reason === "already claimed");
const names = await reg.nip05Names(S);
t("nostr.json lists dotted name", typeof names["maria.vend"] === "string" && typeof names["vend"] === "string");
t("claimHandle refuses dotted", !(await reg.claimHandle("joe.vend", NPUB_A, S)).ok);

// ---- problem 1: index reads from origin --------------------------------------
fake.getCalls.length = 0;
await reg.nip05Names(S);
await reg.findAllByNpub(NPUB_A);
const idxCalls = fake.getCalls.filter((c) => c.pathname === idxPath);
t("index reads use useCache:false", idxCalls.length > 0 && idxCalls.every((c) => c.useCache === false));

// stale CDN copy of the index: write a new record behind its back
fake.getCalls.length = 0;
await reg.seatReservedHandle({ handle: "joe.vend", npub: NPUB_B, space: S });
const rmw = fake.getCalls.filter((c) => c.pathname === idxPath);
t("reindex read-modify-write reads from origin", rmw.length > 0 && rmw.every((c) => c.useCache === false));
t("fresh entry survives two seats in a row", "joe.vend" in (await reg.nip05Names(S)));
r = await reg.seatReservedHandle({ handle: "amy.vend", npub: NPUB_B, space: S });
const n2 = await reg.nip05Names(S);
t("no entry dropped after consecutive seats", ["vend", "maria.vend", "joe.vend", "amy.vend"].every((h) => h in n2), Object.keys(n2).join());

// ---- stale index healed on rebuild -------------------------------------------
fake.store.set(recPath("zed.vend"), JSON.stringify({ handle: "zed.vend", npub: NPUB_A, status: "queued", batchId: null, requestedAt: "x" }));
t("index misses an authoritative-only entry", !("zed.vend" in (await reg.nip05Names(S))));
const rb = await reg.rebuildIndex(S);
t("rebuildIndex counts all handles", rb && rb.count === 5, JSON.stringify(rb));
t("rebuild heals the index", "zed.vend" in (await reg.nip05Names(S)));

// whois self-heal: entry only in a record, index lacks it
fake.store.set(recPath("kim.vend"), JSON.stringify({ handle: "kim.vend", npub: NPUB_B, status: "queued", batchId: null, requestedAt: "x" }));
const entry = await reg.getEntry("kim.vend", S);
t("heal puts a missing entry back", (await reg.healIndexEntry(entry, S)) === true && "kim.vend" in (await reg.nip05Names(S)));
t("heal is a no-op when healthy", (await reg.healIndexEntry(entry, S)) === false);
const { nip19 } = await import("nostr-tools");
const NPUB_C = nip19.npubEncode("11".repeat(32));
fake.store.set(recPath("lou.vend"), JSON.stringify({ handle: "lou.vend", npub: NPUB_C, status: "queued", batchId: null, requestedAt: "x" }));
const holds = await reg.findAllByNpub(NPUB_C);
t("npub lookup miss rebuilds the index", holds.some((h) => h.handle === "lou.vend"));

// ---- (c)(d) server-to-server route -------------------------------------------
const req = (body, secret) =>
  new Request("http://x/api/registry/subname", {
    method: "POST",
    headers: { "content-type": "application/json", ...(secret ? { "x-frens-subname-secret": secret } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
fake.reset();
await reg.seatReservedHandle({ handle: "vend", npub: NPUB_A, space: S });
let res = await api.handleSubnameRequest(req({ parent: "vend", name: "maria", npub: NPUB_B }, "s3cret"), "seat");
t("unset env = 503 not configured", res.status === 503 && (await res.json()).reason === "not configured");
t("unset env wrote nothing", !fake.store.has(recPath("maria.vend")));

process.env.FRENS_SUBNAME_SECRET_VEND = "s3cret-value";
res = await api.handleSubnameRequest(req({ parent: "vend", name: "maria", npub: NPUB_B }), "seat");
t("missing secret = 401", res.status === 401);
res = await api.handleSubnameRequest(req({ parent: "vend", name: "maria", npub: NPUB_B }, "wrong"), "seat");
t("wrong secret = 401", res.status === 401);
t("bad secret wrote nothing", !fake.store.has(recPath("maria.vend")));
res = await api.handleSubnameRequest(req("not json", "s3cret-value"), "seat");
t("bad json = 400", res.status === 400);
res = await api.handleSubnameRequest(req({ parent: "pac", name: "maria", npub: NPUB_B }, "s3cret-value"), "seat");
t("other parent = 400", res.status === 400);
res = await api.handleSubnameRequest(req({ parent: "vend", name: "maria.x", npub: NPUB_B }, "s3cret-value"), "seat");
t("dotted name part = 400", res.status === 400);
res = await api.handleSubnameRequest(req({ parent: "vend", name: "maria", npub: "npub1bad" }, "s3cret-value"), "seat");
t("bad npub = 400", res.status === 400 && /npub|key/.test((await res.json()).reason));
res = await api.handleSubnameRequest(req({ parent: "vend", name: "maria", npub: NPUB_B }, "s3cret-value"), "seat");
t("good seat = 200", res.status === 200 && fake.store.has(recPath("maria.vend")));
res = await api.handleSubnameRequest(req({ parent: "vend", name: "maria", npub: NPUB_A }, "s3cret-value"), "seat");
t("duplicate = 409, no overwrite", res.status === 409 && JSON.parse(fake.store.get(recPath("maria.vend"))).npub === NPUB_B);
res = await api.handleSubnameRequest(req({ parent: "vend", name: "maria" }, "s3cret-value"), "release");
t("release = 200 and gone", res.status === 200 && !fake.store.has(recPath("maria.vend")) && !("maria.vend" in (await reg.nip05Names(S))));
res = await api.handleSubnameRequest(req({ parent: "vend", name: "maria" }, "s3cret-value"), "release");
t("release unknown = 409", res.status === 409);

api.resetSubnameRateLimit();
let last = 0;
for (let i = 0; i < 25; i++) {
  last = (await api.handleSubnameRequest(req({ parent: "vend", name: "x" + i, npub: "npub1bad" }, "s3cret-value"), "seat")).status;
}
t("rate limit answers 429", last === 429);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
