/**
 * Auto-confirm harness (Admiral's ruling, block 973,932: "auto confirm daily
 * cap"). Offline: Printful is a stubbed global.fetch. Orders and the daily
 * total ride the real dev-file driver and are removed at the end.
 *
 * Run from the repo root:  node scripts/auto-confirm.test.mjs
 */
import path from "path";
import { rm } from "fs/promises";
import { registerHooks } from "node:module";
import { resolve as resolveTsLoose } from "./lib/ts-loose-resolve.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
registerHooks({ resolve: resolveTsLoose });

for (const k of ["PRINTFUL_API_KEY", "PRINTFUL_STORE_ID", "PRINTFUL_AUTO_CONFIRM", "PRINTFUL_AUTO_CONFIRM_DAILY_USD", "KV_REST_API_URL", "KV_REST_API_TOKEN", "REDIS_URL"]) {
  delete process.env[k];
}

const ac = await import(path.join(root, "src", "lib", "auto-confirm.ts"));
const { parseCostsUsdMinor } = await import(path.join(root, "src", "lib", "printful.ts"));
const { settleDropshipFromOrder } = await import(path.join(root, "src", "lib", "dropship.ts"));
const { upsertItem, removeItem, createOrder, getOrder, newOrderId } = await import(path.join(root, "src", "lib", "store.ts"));

let passed = 0, failed = 0;
function t(name, cond, extra = "") {
  if (cond) passed++;
  else { failed++; console.log(`FAIL  ${name}${extra ? ` - ${extra}` : ""}`); }
}

// ---- pure: settings -------------------------------------------------------
t("settings: unset = off", ac.autoConfirmSettings({}).enabled === false);
t("settings: switch on but no cap = off", ac.autoConfirmSettings({ PRINTFUL_AUTO_CONFIRM: "on" }).enabled === false);
t("settings: cap 0 = off", ac.autoConfirmSettings({ PRINTFUL_AUTO_CONFIRM: "on", PRINTFUL_AUTO_CONFIRM_DAILY_USD: "0" }).enabled === false);
t("settings: cap but switch not on = off", ac.autoConfirmSettings({ PRINTFUL_AUTO_CONFIRM_DAILY_USD: "100" }).enabled === false);
const on = ac.autoConfirmSettings({ PRINTFUL_AUTO_CONFIRM: "on", PRINTFUL_AUTO_CONFIRM_DAILY_USD: "100" });
t("settings: on + cap = enabled, cap in cents", on.enabled && on.capUsdMinor === 10000);

// ---- pure: costs parse ----------------------------------------------------
t("costs: dollar string to cents", parseCostsUsdMinor({ total: "12.34" }) === 1234);
t("costs: missing = null", parseCostsUsdMinor(undefined) === null && parseCostsUsdMinor({}) === null);
t("costs: other currency = null", parseCostsUsdMinor({ total: "10", currency: "EUR" }) === null);

// ---- pure: paid in USD ----------------------------------------------------
t("paid: USD order exact", ac.paidUsdMinor({ amount: 3000, currency: "USD" }, null).minor === 3000);
t("paid: sats with no rate = unknown", ac.paidUsdMinor({ amount: 100000, currency: "SATS" }, null).minor === null);
t("paid: sats with live rate", ac.paidUsdMinor({ amount: 100000, currency: "SATS" }, 100000).minor === 100000 / 1e8 * 100000 * 100);
t("paid: stored rate beats live", ac.paidUsdMinor({ amount: 100000, currency: "SATS", rate: 50000 }, 100000).minor === Math.floor(50000 / 1e8 * 100000 * 100));
t("paid: other currency = unknown", ac.paidUsdMinor({ amount: 5, currency: "EUR" }, 1).minor === null);

// ---- pure: decision -------------------------------------------------------
const base = { settings: on, costUsdMinor: 1500, paidUsdMinor: 3000, paidFromSats: false, usedTodayUsdMinor: 0, dropshipState: "draft_created", alreadyDecided: false };
t("decide: all guards pass = confirm", ac.decideAutoConfirm(base).decision === "confirm");
t("decide: cap off = held", ac.decideAutoConfirm({ ...base, settings: { enabled: false, capUsdMinor: 0 } }).decision === "held");
t("decide: under cap = confirm", ac.decideAutoConfirm({ ...base, usedTodayUsdMinor: 8500 }).decision === "confirm");
t("decide: over cap = held", ac.decideAutoConfirm({ ...base, usedTodayUsdMinor: 8501 }).decision === "held");
t("decide: cost above paid = held", ac.decideAutoConfirm({ ...base, costUsdMinor: 3001 }).decision === "held");
t("decide: unknown USD value = held", ac.decideAutoConfirm({ ...base, paidUsdMinor: null }).decision === "held");
t("decide: unreadable cost = held", ac.decideAutoConfirm({ ...base, costUsdMinor: null }).decision === "held");
t("decide: already past draft (retry) = held", ac.decideAutoConfirm({ ...base, dropshipState: "submitted" }).decision === "held");
t("decide: already decided = held", ac.decideAutoConfirm({ ...base, alreadyDecided: true }).decision === "held");
t("decide: sats order keeps a margin", ac.decideAutoConfirm({ ...base, paidFromSats: true, costUsdMinor: 2900 }).decision === "held");
t("decide: held always says why", ac.decideAutoConfirm({ ...base, paidUsdMinor: null }).reason.length > 5);

// ---- wired: settle path with stubbed Printful -----------------------------
process.env.PRINTFUL_API_KEY = "test-key";
const realFetch = global.fetch;
let confirms = 0;
let draftCost = "12.00";
let nextId = 700;
global.fetch = async (url, init) => {
  const u = String(url);
  if (u.endsWith("/orders") && init?.method === "POST") {
    return { ok: true, json: async () => ({ result: { id: ++nextId, costs: { total: draftCost, currency: "USD" } } }) };
  }
  if (u.endsWith("/confirm")) { confirms++; return { ok: true, json: async () => ({}) }; }
  return { ok: false, status: 404, text: async () => "unexpected" };
};

const createdOrders = [];
await upsertItem({
  id: "ac-item", schemaVersion: 2, title: "AC Tee", blurb: "t", images: [], media: { images: [] },
  kind: "self", price: { fiat: { amount: 3000, currency: "USD" } }, fulfillment: "self", status: "live",
  sizes: ["M"], partner: "printful", partnerVariantIds: { M: "m-id" },
});
async function mk(over = {}) {
  const id = newOrderId();
  const order = {
    id, schemaVersion: 2, state: "settled",
    lineItems: [{ itemId: "ac-item", title: "AC Tee", qty: 1, size: "M" }],
    priceSnapshot: { amount: 3000, currency: "USD", at: new Date().toISOString() },
    adapterId: "btcpay", chargeIds: ["ac:0"], createdAtMs: Date.now(), events: [],
    shipping: { name: "Ada", address1: "1 Main St", city: "Denver", country: "US" },
    ...over,
  };
  await createOrder(order);
  createdOrders.push(id);
  return order;
}

{ // cap off (env unset): draft stays, no confirm, nothing recorded
  const o = await mk();
  const r = await settleDropshipFromOrder(o);
  const p = await getOrder(o.id);
  t("wired: cap off = draft_created, no confirm", r.state === "draft_created" && confirms === 0 && !p.dropship.autoConfirm);
}

process.env.PRINTFUL_AUTO_CONFIRM = "on";
process.env.PRINTFUL_AUTO_CONFIRM_DAILY_USD = "25";

{ // under cap: confirmed, recorded, total moves
  const o = await mk();
  const r = await settleDropshipFromOrder(o);
  const p = await getOrder(o.id);
  t("wired: under cap = submitted", r.state === "submitted" && p.dropship.state === "submitted" && confirms === 1);
  t("wired: decision recorded", p.dropship.autoConfirm?.decision === "confirmed" && p.dropship.autoConfirm.costUsdMinor === 1200);
  t("wired: daily total counts it", (await ac.autoConfirmUsedToday()) === 1200);
  // retry after confirmed: no second confirm, no second draft
  const again = await settleDropshipFromOrder(p);
  t("wired: retry after confirmed = no second confirm", again.ran === false && confirms === 1);
}

{ // over cap (12 used + 12 = 24 ok, third 36 > 25): second confirms, third held
  const o2 = await mk();
  await settleDropshipFromOrder(o2);
  t("wired: second fits under the cap", confirms === 2);
  const o3 = await mk();
  const r3 = await settleDropshipFromOrder(o3);
  const p3 = await getOrder(o3.id);
  t("wired: over cap = held draft", r3.state === "draft_created" && confirms === 2 && p3.dropship.autoConfirm?.decision === "held" && p3.dropship.autoConfirm.reason.includes("cap"));
}

{ // cost above paid
  draftCost = "31.00";
  process.env.PRINTFUL_AUTO_CONFIRM_DAILY_USD = "500";
  const before = confirms;
  const o = await mk();
  const r = await settleDropshipFromOrder(o);
  const p = await getOrder(o.id);
  t("wired: cost above paid = held", r.state === "draft_created" && confirms === before && p.dropship.autoConfirm?.decision === "held");
  draftCost = "12.00";
}

{ // unknown USD value: sats order, no stored rate, rate source dark
  const before = confirms;
  global.fetch = async (url, init) => {
    const u = String(url);
    if (u.endsWith("/orders") && init?.method === "POST") return { ok: true, json: async () => ({ result: { id: ++nextId, costs: { total: "5.00" } } }) };
    if (u.endsWith("/confirm")) { confirms++; return { ok: true, json: async () => ({}) }; }
    return { ok: false, status: 503, text: async () => "dark" };
  };
  const o = await mk({ priceSnapshot: { amount: 100000, currency: "SATS", at: new Date().toISOString() } });
  const r = await settleDropshipFromOrder(o);
  const p = await getOrder(o.id);
  t("wired: unknown USD value = held", r.state === "draft_created" && confirms === before && p.dropship.autoConfirm?.reason.includes("USD value"));
}

global.fetch = realFetch;
for (const k of ["PRINTFUL_API_KEY", "PRINTFUL_AUTO_CONFIRM", "PRINTFUL_AUTO_CONFIRM_DAILY_USD"]) delete process.env[k];

for (const id of createdOrders) await rm(path.join(root, "data", "store-orders", `${id}.json`), { force: true });
await rm(path.join(root, "data", "store-auto-confirm", `${ac.utcDay()}.json`), { force: true });
await removeItem("ac-item");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
