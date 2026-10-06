/**
 * Private store behaviour (src/lib/private-store.ts): documents by key on the
 * dev file driver, fail-closed with no store in production, the move of older
 * blob copies (blob layer stubbed, no network), and, when REDIS_URL is in the
 * environment of the command, the same against a real key-value server
 * (orders ride the same vault, so their behaviour is checked there too).
 * All data here is fake. The server section writes and clears real keys, so it
 * only runs against a server on this machine (127.0.0.1, localhost or ::1).
 *
 * Run from the repo root:  node scripts/private-store.test.mjs
 *   with a server:  REDIS_URL=redis://127.0.0.1:5466 node scripts/private-store.test.mjs
 */

import os from "os";
import path from "path";
import { mkdtemp, rm, readFile, mkdir, writeFile } from "fs/promises";
import { registerHooks } from "node:module";
import { resolve as resolveTsLoose } from "./lib/ts-loose-resolve.mjs";

registerHooks({ resolve: resolveTsLoose });

/** Only a server on this machine: the section below writes and clears keys. */
function localServer(url) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
    return ["127.0.0.1", "localhost", "::1"].includes(host) ? url : null;
  } catch {
    return null;
  }
}
const REDIS = localServer(process.env.REDIS_URL);
const REDIS_REFUSED = !!process.env.REDIS_URL && !REDIS;
const FAKE = '{"deployHook":"not-a-real-token"}';

for (const k of ["KV_REST_API_URL", "KV_REST_API_TOKEN", "REDIS_URL", "VERCEL", "BLOB_READ_WRITE_TOKEN", "REGISTRY_DRIVER"]) {
  delete process.env[k];
}

const ps = await import("../src/lib/private-store.ts");

let failed = 0;
let passed = 0;
function check(name, ok, extra) {
  if (ok) passed++;
  else {
    failed++;
    console.error(`FAIL ${name}${extra ? ": " + extra : ""}`);
  }
}

/** a fake private side with create-if-not-exists, plus a fake older copy */
function fakeIO({ legacyText, failPut, corrupt, delay = 0 } = {}) {
  const st = { legacy: legacyText ?? null, priv: null, creates: 0, removes: 0, logs: [] };
  const wait = () => (delay ? new Promise((r) => setTimeout(r, delay)) : Promise.resolve());
  st.io = {
    async readLegacy() {
      await wait();
      return st.legacy;
    },
    async readPrivate() {
      await wait();
      return corrupt && st.priv !== null ? st.priv + " (changed)" : st.priv;
    },
    async putIfAbsent(text) {
      await wait();
      if (failPut) throw new Error("boom");
      if (st.priv !== null) return false;
      st.priv = text;
      st.creates++;
      return true;
    },
    async removeLegacy() {
      st.removes++;
      st.legacy = null;
    },
    log: (l) => st.logs.push(l),
  };
  return st;
}

// ---- the move, with every storage call passed in ---------------------------
{
  const a = fakeIO();
  check("move: no older copy returns null", (await ps.moveLegacyDoc("doc-a", a.io)) === null && a.creates === 0 && a.removes === 0);

  const b = fakeIO({ legacyText: FAKE });
  const got = await ps.moveLegacyDoc("doc-b", b.io);
  check("move: older copy served", got === FAKE);
  check("move: copied, read back, then removed", b.priv === FAKE && b.removes === 1 && b.legacy === null && b.logs.length === 0);
  check("move: run again is a no-op", (await ps.moveLegacyDoc("doc-b", b.io)) === null && b.creates === 1);

  const c = fakeIO({ legacyText: FAKE, failPut: true });
  const gc = await ps.moveLegacyDoc("doc-c", c.io);
  check("move: failed private write serves older, removes nothing", gc === FAKE && c.removes === 0 && c.legacy === FAKE);
  check("move: failure logs one line naming the doc, never the content", c.logs.length === 1 && c.logs[0].includes("doc-c") && !c.logs[0].includes("not-a-real-token"));

  const d = fakeIO({ legacyText: FAKE, corrupt: true });
  const gd = await ps.moveLegacyDoc("doc-d", d.io);
  check("move: read-back differs serves older, removes nothing", gd === FAKE && d.removes === 0 && d.legacy === FAKE);
  check("move: mismatch logs one clean line", d.logs.length === 1 && d.logs[0].includes("doc-d") && !d.logs[0].includes("not-a-real-token"));

  const e = fakeIO({ legacyText: FAKE, delay: 5 });
  const [r1, r2, r3] = await Promise.all([ps.moveLegacyDoc("doc-e", e.io), ps.moveLegacyDoc("doc-e", e.io), ps.moveLegacyDoc("doc-e", e.io)]);
  check("move: concurrent movers all serve the content", r1 === FAKE && r2 === FAKE && r3 === FAKE);
  check("move: concurrent movers create once, private copy intact", e.creates === 1 && e.priv === FAKE && e.legacy === null && e.logs.length === 0);

  const f = fakeIO({ legacyText: FAKE });
  f.priv = '{"newer":true}';
  const gf = await ps.moveLegacyDoc("doc-f", f.io);
  check("move: a different private copy wins, older kept", gf === '{"newer":true}' && f.removes === 0);
}

// ---- dev file driver --------------------------------------------------------
const tmp = await mkdtemp(path.join(os.tmpdir(), "frens-private-store-"));
process.chdir(tmp);
try {
  check("file: absent doc is null", (await ps.readDoc({ key: "x/a.json" })) === null);
  await ps.writeDoc({ key: "x/a.json" }, { n: 1 });
  check("file: write then read", JSON.stringify(await ps.readDoc({ key: "x/a.json" })) === '{"n":1}');
  check("file: lands under data/private-docs", JSON.parse(await readFile(path.join(tmp, "data", "private-docs", "x", "a.json"), "utf8")).n === 1);
  await ps.writeDocText({ key: "x/b.json" }, '{"n":2}');
  const texts = (await ps.readDocTexts("x/")).sort();
  check("file: prefix read", texts.length === 2 && texts[1] === '{"n":2}');
  await mkdir(path.join(tmp, "data"), { recursive: true });
  await writeFile(path.join(tmp, "data", "nodes.json"), FAKE);
  check("file: explicit dev file honoured", (await ps.readDocText({ key: "config/nodes.json", file: path.join(tmp, "data", "nodes.json") })) === FAKE);
  check("file: writable", ps.docsWritable() === true);

  // fail closed: production, no store
  process.env.VERCEL = "1";
  process.env.BLOB_READ_WRITE_TOKEN = "not-a-real-token";
  const older = new Map([["k/old.json", FAKE], ["p/one.json", '{"id":"1"}']]);
  const puts = [];
  ps.setLegacyBlobForTest({
    read: async (k) => older.get(k) ?? null,
    list: async (p) => [...older.keys()].filter((k) => k.startsWith(p)),
    remove: async (k) => puts.push("remove " + k),
  });
  check("closed: not writable", ps.docsWritable() === false);
  let msg = "";
  try {
    await ps.writeDoc({ key: "k/new.json" }, { a: 1 });
  } catch (err) {
    msg = err.message;
  }
  check("closed: write refused naming the variables", msg.includes("REDIS_URL") && msg.includes("KV_REST_API_URL") && msg.includes("KV_REST_API_TOKEN"), msg);
  let msg2 = "";
  try {
    await ps.writeDocText({ key: "k/new.json" }, "{}");
  } catch (err) {
    msg2 = err.message;
  }
  check("closed: text write refused too", msg2 === msg);
  check("closed: read falls back to the older copy", (await ps.readDocText({ key: "k/old.json" })) === FAKE);
  check("closed: prefix read falls back", (await ps.readDocTexts("p/")).length === 1);
  check("closed: nothing removed, nothing written", puts.length === 0 && !older.has("k/new.json"));
  ps.setLegacyBlobForTest();
  delete process.env.VERCEL;
  delete process.env.BLOB_READ_WRITE_TOKEN;
} finally {
  process.chdir(os.homedir());
  await rm(tmp, { recursive: true, force: true });
}

// ---- a real key-value server -------------------------------------------------
if (REDIS) {
  process.env.REDIS_URL = REDIS;
  const tag = `t${Date.now()}`;
  const key = (s) => `${tag}/${s}`;
  const older = new Map();
  const log = [];
  const realWarn = console.warn;
  console.warn = (l) => log.push(String(l));
  ps.setLegacyBlobForTest({
    read: async (k) => older.get(k) ?? null,
    list: async (p) => [...older.keys()].filter((k) => k.startsWith(p)),
    remove: async (k) => {
      older.delete(k);
    },
  });
  process.env.BLOB_READ_WRITE_TOKEN = "not-a-real-token";
  process.env.REGISTRY_DRIVER = "blob";
  try {
    check("vault: driver writable", ps.docsWritable() === true);
    await ps.writeDoc({ key: key("a.json") }, { v: 1 });
    check("vault: write then read", (await ps.readDoc({ key: key("a.json") })).v === 1);
    check("vault: absent is null", (await ps.readDoc({ key: key("none.json") })) === null);

    older.set(key("m.json"), FAKE);
    const [x, y, z] = await Promise.all([1, 2, 3].map(() => ps.readDocText({ key: key("m.json") })));
    check("vault: concurrent readers all get the content", x === FAKE && y === FAKE && z === FAKE);
    check("vault: older copy removed after the move", !older.has(key("m.json")));
    check("vault: private copy holds it", (await ps.readDocText({ key: key("m.json") })) === FAKE);
    check("vault: second read does not touch the older side", (await ps.readDocText({ key: key("m.json") })) === FAKE && log.length === 0, log.join("|"));

    older.set(key("list/1.json"), '{"id":"1"}');
    older.set(key("list/2.json"), '{"id":"2"}');
    await ps.writeDocText({ key: key("list/3.json") }, '{"id":"3"}');
    const first = (await ps.readDocTexts(key("list/"))).sort();
    check("vault: prefix read merges private and older", first.length === 3, String(first.length));
    check("vault: prefix read moved the older ones", older.size === 0);
    check("vault: prefix read again gives the same three", (await ps.readDocTexts(key("list/"))).length === 3);

    // once a private copy exists, an older copy does not outlive it
    older.set(key("w.json"), FAKE);
    await ps.writeDocText({ key: key("w.json") }, '{"newer":true}');
    check("vault: a write removes the older copy", !older.has(key("w.json")));
    check("vault: the written text is what reads back", (await ps.readDocText({ key: key("w.json") })) === '{"newer":true}');
    older.set(key("list/3.json"), '{"id":"stale"}');
    const again = await ps.readDocTexts(key("list/"));
    check("vault: prefix read removes an older copy that has a private one", !older.has(key("list/3.json")));
    check("vault: and keeps serving the private text", again.length === 3 && again.includes('{"id":"3"}') && !again.includes('{"id":"stale"}'));
    older.set(key("gone.json"), FAKE);
    ps.setLegacyBlobForTest({
      read: async (k) => older.get(k) ?? null,
      list: async (p) => [...older.keys()].filter((k) => k.startsWith(p)),
      remove: async () => {
        throw new Error("boom");
      },
    });
    await ps.writeDocText({ key: key("gone.json") }, "{}");
    check("vault: a failed removal still writes, and logs one line without content", (await ps.readDocText({ key: key("gone.json") })) === "{}" && log.length === 1 && log[0].includes(key("gone.json")) && !log[0].includes("not-a-real-token"), log.join("|"));

    // orders: same keys, same index, same errors
    const store = await import("../src/lib/store.ts");
    const id = store.newOrderId();
    const order = {
      id, schemaVersion: 2, state: "created", lineItems: [], priceSnapshot: { amount: 1, currency: "SATS", at: "x" },
      adapterId: "fake", chargeIds: [], createdAtMs: Date.now(), events: [],
    };
    await store.createOrder(order);
    check("orders: round trip", (await store.getOrder(id))?.id === id);
    check("orders: index has it", (await store.listOrders()).some((o) => o.id === id));
    let collide = "";
    try {
      await store.createOrder(order);
    } catch (err) {
      collide = err.message;
    }
    check("orders: same collision error", collide === "order store: id collision", collide);
    let bad = "";
    try {
      await store.createOrder({ ...order, id: "nope" });
    } catch (err) {
      bad = err.message;
    }
    check("orders: same bad id error", bad === "order store: bad id", bad);
    check("orders: order key is the old one", (await ps.kv(["GET", `store:order:${id}`]))?.result !== null);

    // the catalog is a document now
    await store.upsertItem({ id: "fake-item", schemaVersion: 2, title: "Fake", blurb: "", images: [], kind: "self", price: { sats: 1 }, fulfillment: "self", status: "live" });
    check("catalog: read back from the vault", (await store.getItem("fake-item"))?.title === "Fake");
    check("catalog: stored as a document", typeof (await ps.kv(["GET", "store:doc:store/catalog.json"]))?.result === "string");

    // clean up what this run made
    for (const k of [key("a.json"), key("m.json"), key("w.json"), key("gone.json"), key("list/1.json"), key("list/2.json"), key("list/3.json"), "store/catalog.json"]) {
      await ps.kv(["DEL", `store:doc:${k}`]);
      await ps.kv(["SREM", "store:docs:index", k]);
    }
    await ps.kv(["DEL", `store:order:${id}`]);
    await ps.kv(["SREM", "store:orders:index", id]);
  } finally {
    console.warn = realWarn;
  }
} else if (REDIS_REFUSED) {
  console.log("private-store: REDIS_URL is not a server on this machine, key-value server section skipped");
} else {
  console.log("private-store: no REDIS_URL in the environment, key-value server section skipped");
}

console.log(`private-store: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
