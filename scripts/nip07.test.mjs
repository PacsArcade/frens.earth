/**
 * NIP-07 helper: a fake window.nostr proves the time limit, the pass-through of
 * the signer's own words, the late-answer rule and the synchronous call (the
 * Ditto first-connect gesture rule). OFFLINE.
 *
 * Run from the repo root:  node scripts/nip07.test.mjs
 */
import path from "path";
import { registerHooks } from "node:module";
import { resolve as resolveTsLoose } from "./lib/ts-loose-resolve.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
registerHooks({ resolve: resolveTsLoose });
const h = await import(path.join(root, "src/lib/nip07.ts"));

let passed = 0, failed = 0;
function t(name, cond, extra = "") {
  if (cond) passed++;
  else { failed++; console.log(`FAIL  ${name}${extra ? ` - ${extra}` : ""}`); }
}
const tpl = { kind: 22242, created_at: 1, tags: [], content: "x" };
const ev = { id: "i", pubkey: "p", sig: "s" };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.window = globalThis;

// missing signer
delete globalThis.nostr;
let r = await h.nip07SignEvent(tpl);
t("missing: kind", !r.ok && r.kind === "missing");
r = await h.nip07GetPublicKey();
t("missing getPublicKey: kind", !r.ok && r.kind === "missing");

// resolves
globalThis.nostr = { signEvent: async () => ev, getPublicKey: async () => "abc" };
r = await h.nip07SignEvent(tpl);
t("resolving signer: ok + value", r.ok && r.value === ev);
r = await h.nip07GetPublicKey();
t("getPublicKey: ok + value", r.ok && r.value === "abc");

// rejects: message passes through as plain text, trimmed
globalThis.nostr = { signEvent: async () => { throw new Error("  Not logged in. Open the Ditto Extension to log in.  "); } };
r = await h.nip07SignEvent(tpl);
t("rejecting signer: kind signer", !r.ok && r.kind === "signer");
t("rejecting signer: message passed through", r.message === "Not logged in. Open the Ditto Extension to log in.", r.message);
t("failure copy names the signer", h.nip07FailureCopy(r) === "your signer said: Not logged in. Open the Ditto Extension to log in.");
globalThis.nostr = { signEvent: () => Promise.reject("plain string reason") };
r = await h.nip07SignEvent(tpl);
t("non-Error rejection becomes text", !r.ok && r.message === "plain string reason");
globalThis.nostr = { signEvent: () => Promise.reject(new Error("x".repeat(500))) };
r = await h.nip07SignEvent(tpl);
t("long message capped", !r.ok && r.message.length <= 160);
globalThis.nostr = { signEvent: () => { throw new Error("sync boom"); } };
r = await h.nip07SignEvent(tpl);
t("synchronous throw caught", !r.ok && r.kind === "signer" && r.message === "sync boom");

// never answers: timeout, and the slow hint fires once first
globalThis.nostr = { signEvent: () => new Promise(() => {}) };
let slow = 0;
const t0 = Date.now();
r = await h.nip07SignEvent(tpl, { timeoutMs: 120, hintMs: 40, onSlow: () => slow++ });
t("never-resolving signer: timeout", !r.ok && r.kind === "timeout");
t("timeout fires near the limit", Date.now() - t0 >= 100 && Date.now() - t0 < 1000);
t("slow hint fired exactly once", slow === 1, String(slow));
t("timeout copy has no signer text", h.nip07FailureCopy(r) === h.NIP07_TIMEOUT_COPY);

// fast answer: hint never fires
slow = 0;
globalThis.nostr = { signEvent: async () => ev };
r = await h.nip07SignEvent(tpl, { timeoutMs: 200, hintMs: 50, onSlow: () => slow++ });
await wait(120);
t("fast signer: no hint", r.ok && slow === 0);

// late answer after the limit is ignored
let release;
globalThis.nostr = { signEvent: () => new Promise((res) => { release = res; }) };
r = await h.nip07SignEvent(tpl, { timeoutMs: 40 });
release(ev);
await wait(30);
t("late answer ignored: still timeout", !r.ok && r.kind === "timeout");

// signer is invoked synchronously, before the helper's first await
let called = false;
globalThis.nostr = { signEvent: async () => { called = true; return ev; }, getPublicKey: async () => { called = true; return "k"; } };
let p = h.nip07SignEvent(tpl);
t("signEvent called synchronously", called === true);
await p;
called = false;
p = h.nip07GetPublicKey();
t("getPublicKey called synchronously", called === true);
await p;

console.log(`nip07: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
