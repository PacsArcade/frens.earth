/**
 * Printful API rail: pricing math, the shipping add-on, the one-item mockup
 * step. Everything OFFLINE: global.fetch is a stub, the blob writer is a
 * stub, no Printful or Vercel call is ever made and no key is read.
 *
 * Run from the repo root:  node scripts/printful-api.test.mjs
 */
import path from "path";
import { registerHooks } from "node:module";
import { resolve as resolveTsLoose } from "./lib/ts-loose-resolve.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
registerHooks({ resolve: resolveTsLoose });

delete process.env.PRINTFUL_STORE_ID;
process.env.PRINTFUL_API_KEY = "test-key-not-real";

const { sellPriceCents, parseVariantCost, toCents } = await import(path.join(root, "src/lib/printful-pricing.ts"));
const { cheapestRate, quoteShipping, chargeWithShipping } = await import(path.join(root, "src/lib/printful-shipping.ts"));
const { mockupStep, pickStyles, v2Urls, v1Urls, unavailableStyleIds } = await import(path.join(root, "src/lib/printful-mockups.ts"));
const { fiatMinorToSats } = await import(path.join(root, "src/lib/btc-rate.ts"));

let passed = 0, failed = 0;
function t(name, cond, extra = "") {
  if (cond) passed++;
  else { failed++; console.log(`FAIL  ${name}${extra ? ` - ${extra}` : ""}`); }
}

const json = (body, init = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });

/** route table fetch stub: [matcher, handler] pairs; records calls */
function stubFetch(routes) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, init });
    for (const [match, handler] of routes) {
      if (u.includes(match)) return handler(u, init);
    }
    return new Response("no route", { status: 599 });
  };
  return calls;
}

// ---- pricing math ----------------------------------------------------
t("sellPrice: 10.00 -> 12.10", sellPriceCents(1000) === 1210);
t("sellPrice: 12.95 -> 15.67 (15.6695 rounds UP)", sellPriceCents(1295) === 1567);
t("sellPrice: 0.01 -> 0.02 (never down)", sellPriceCents(1) === 2);
t("sellPrice: exact boundary 100 -> 121", sellPriceCents(100) === 121);
t("toCents: string and number", toCents("12.95") === 1295 && toCents(12.95) === 1295 && toCents("x") === null);

const prices = {
  data: {
    currency: "USD",
    variant: { techniques: [{ technique_key: "dtg", price: "10.00", discounted_price: "9.50" }, { technique_key: "embroidery", price: "14.00" }] },
    product: { placements: [
      { id: "front", technique: "dtg", price: "0.00" },
      { id: "back", technique: "dtg", price: "2.25", discounted_price: "2.00" },
    ] },
  },
};
{
  const c = parseVariantCost(prices, ["front"]);
  t("cost: discounted technique price, free front", c.ok && c.costCents === 950 && c.technique === "dtg");
  const c2 = parseVariantCost(prices, ["front", "back"]);
  t("cost: adds the back placement (discounted wins)", c2.ok && c2.costCents === 1150);
  const multi = { data: { variant: { techniques: [{ technique_key: "embroidery", price: "9.00" }, { technique_key: "dtg", price: "11.00" }] }, product: { placements: [{ id: "front_large", technique_key: "dtg", price: "0.00" }, { id: "back", technique_key: "dtg", price: "5.95" }] } } };
  const c3 = parseVariantCost(multi, ["front", "back"]);
  t("cost: suffixed placement ids match and pick their technique", c3.ok && c3.technique === "dtg" && c3.costCents === 1695);
  const c4 = parseVariantCost({ data: { variant: { techniques: [{ technique_key: "embroidery", price: "9.00" }, { technique_key: "dtg", price: "11.00" }] } } }, ["front"]);
  t("cost: several techniques and no placement info falls back to DTG", c4.ok && c4.technique === "dtg" && c4.costCents === 1100);
  const c5 = parseVariantCost({ data: { variant: { techniques: [{ technique_key: "a", price: "1" }, { technique_key: "b", price: "2" }] } } }, ["front"]);
  t("cost: unknown techniques refuse and name what was offered", !c5.ok && /techniques: a, b/.test(c5.error));
  const many = { data: { variant: { techniques: [{ technique_key: "dtg", price: "12.00" }] }, product: { placements: [{ id: "front", technique_key: "dtg", price: "0.00" }, { id: "front_large", technique_key: "dtg", price: "5.95" }, { id: "front_small", technique_key: "dtg", price: "2.95" }, { id: "back", technique_key: "dtg", price: "5.95" }] } } };
  const c6 = parseVariantCost(many, ["front", "back"]);
  t("cost: counts ONE placement per design (exact id wins over suffixed)", c6.ok && c6.costCents === 1795 && c6.parts.length === 3);
  // the live tee (block 973,835): /prices lists front at 6.25 too, but the
  // dashboard's $23 proves the technique price already pays for the front
  const tee = { data: { variant: { techniques: [{ technique_key: "dtg", price: "14.25" }] }, product: { placements: [{ id: "front", technique_key: "dtg", price: "6.25" }, { id: "back", technique_key: "dtg", price: "6.25" }, { id: "sleeve_left", technique_key: "dtg", price: "2.75" }] } } };
  const c7 = parseVariantCost(tee, ["front", "back", "sleeve_left"]);
  t("cost: the front is included in the technique price ($23.25 tee)", c7.ok && c7.costCents === 2325, JSON.stringify(c7));
  t("cost: the included front shows as a 0 part", c7.ok && c7.parts.some((p) => p.name === "placement front (included)" && p.cents === 0));
  const c8 = parseVariantCost(tee, ["back", "sleeve_left"]);
  t("cost: no front -> the cheapest used placement is included", c8.ok && c8.costCents === 2050, JSON.stringify(c8));
  t("cost: no techniques refuses", !parseVariantCost({ data: { variant: { techniques: [] } } }, ["front"]).ok);
  t("cost: garbage refuses", !parseVariantCost(null, ["front"]).ok);
}

// ---- shipping add-on --------------------------------------------------
t("cheapestRate: picks the lowest", cheapestRate([{ name: "Express", rate: "12.00", currency: "USD" }, { name: "Flat", rate: "4.99", currency: "USD" }])?.amountMinor === 499);
t("cheapestRate: nothing usable is null", cheapestRate([{ rate: "x" }]) === null && cheapestRate([]) === null);

const item = { id: "tee", partnerVariantIds: { "": "555" }, partner: "printful" };
const recipient = { name: "Ada", address1: "1 Main St", city: "Denver", state_code: "CO", country_code: "US", zip: "80201" };
const syncVariant = { result: { sync_variant: { id: 555, variant_id: 4012, product: { product_id: 71, variant_id: 4012 }, files: [{ type: "default", url: "https://files.example/d.png" }, { type: "preview", url: "https://files.example/p.png" }] } } };

{
  const calls = stubFetch([
    ["/store/variants/555", () => json(syncVariant)],
    ["/shipping/rates", (u, init) => json({ result: [{ id: "STANDARD", name: "Flat Rate", rate: "4.99", currency: "USD", minDeliveryDays: 3, maxDeliveryDays: 6 }] })],
  ]);
  const q = await quoteShipping(recipient, [{ item, qty: 2 }]);
  t("quote: success is Printful's rate", q.ok && q.amountMinor === 499 && q.method === "Flat Rate");
  const body = JSON.parse(calls.find((c) => c.url.includes("/shipping/rates")).init.body);
  t("quote: sends the catalog variant and quantity", body.items[0].variant_id === 4012 && body.items[0].quantity === 2);
  t("quote: every call carries a timeout signal", calls.every((c) => c.init.signal));
  t("quote: the key is not in the url or body", calls.every((c) => !c.url.includes("test-key") && !String(c.init.body ?? "").includes("test-key")));
}
{
  // the live v1 shape (block 973,767): the sync variant IS the result, and
  // the catalog product id may only come from GET /products/variant/{id}
  const flat = { result: { id: 555, variant_id: 4012, product: { variant_id: 4012 }, files: [{ type: "default", url: "https://files.example/d.png" }] } };
  const calls = stubFetch([
    ["/store/variants/555", () => json(flat)],
    ["/products/variant/4012", () => json({ result: { variant: { id: 4012, product_id: 71 } } })],
    ["/shipping/rates", () => json({ result: [{ id: "STANDARD", name: "Flat Rate", rate: "4.99", currency: "USD" }] })],
  ]);
  const q = await quoteShipping(recipient, [{ item, qty: 1 }]);
  t("live shape: flat sync variant + catalog lookup quotes", q.ok && q.amountMinor === 499);
  t("live shape: asked the catalog for the product", calls.some((c) => c.url.includes("/products/variant/4012")));
}
{
  stubFetch([["/store/variants/555", () => json(syncVariant)], ["/shipping/rates", () => new Response("boom", { status: 500 })]]);
  const q = await quoteShipping(recipient, [{ item, qty: 1 }]);
  t("quote: Printful failure refuses honestly", !q.ok && /try again/.test(q.reason) && !/test-key/.test(q.reason));
}
{
  stubFetch([["/store/variants/555", () => json(syncVariant)], ["/shipping/rates", () => new Response("bad address", { status: 400 })]]);
  const q = await quoteShipping(recipient, [{ item, qty: 1 }]);
  t("quote: address refused says check the address", !q.ok && /address/.test(q.reason));
}
{
  stubFetch([["/store/variants/555", () => { const e = new Error("t"); e.name = "TimeoutError"; throw e; }]]);
  const q = await quoteShipping(recipient, [{ item, qty: 1 }]);
  t("quote: timeout refuses honestly", !q.ok && /try again/.test(q.reason));
}
{
  const q = await quoteShipping(recipient, [{ item: { id: "x", partner: "printful" }, qty: 1 }]);
  t("quote: unmapped item refuses", !q.ok && /not linked/.test(q.reason));
}
{
  const quote = { ok: true, amountMinor: 499, currency: "USD", method: "Flat" };
  const a = await chargeWithShipping({ fiat: { amount: 2000, currency: "USD" } }, quote);
  t("charge: dollars add cents", a.ok && a.amount === 2499 && a.currency === "USD" && a.shippingAmount === 499);
  const b = await chargeWithShipping({ sats: 30000 }, quote, async () => 7000);
  t("charge: sats item adds shipping in sats", b.ok && b.amount === 37000 && b.currency === "SATS");
  const c = await chargeWithShipping({ sats: 30000 }, quote, async () => null);
  t("charge: no bitcoin rate refuses", !c.ok);
  const d = await chargeWithShipping({ fiat: { amount: 2000, currency: "EUR" } }, quote);
  t("charge: never mixes currencies", !d.ok);
  const e = await chargeWithShipping({ fiat: { amount: 2000, currency: "USD" } }, { ...quote, currency: "EUR" });
  t("charge: non-dollar quote refuses", !e.ok);
}
t("sats: 15.67 USD at 100000 USD/BTC = 15670 sats", fiatMinorToSats(1567, 100000) === 15670);
t("sats: rounds up", fiatMinorToSats(1, 100000) === 10);

// ---- mockup step -------------------------------------------------------
t("pickStyles: model views first, capped, deduped", (() => {
  const g = [{ placement: "front", technique: "dtg", mockup_styles: [{ id: 1, view_name: "Flat" }, { id: 2, category: "Lifestyle" }, { id: 3, view_name: "On model" }, { id: 1, view_name: "Flat" }] }, { placement: "back", mockup_styles: [{ id: 9 }] }];
  const r = pickStyles(g, ["front"], 2);
  return r.styleIds.join() === "2,3" && r.techniques.front === "dtg";
})());
t("v2Urls/v1Urls collect distinct urls",
  v2Urls({ catalog_variant_mockups: [{ mockups: [{ mockup_url: "a" }, { mockup_url: "a" }, { mockup_url: "b" }] }] }).join() === "a,b" &&
  v1Urls([{ mockup_url: "a", extra: [{ url: "b" }, { url: "a" }] }]).join() === "a,b");

const styles = { data: [{ placement: "front", technique: "dtg", mockup_styles: [1, 2, 3, 4, 5, 6].map((id) => ({ id, category: id > 3 ? "Lifestyle" : "Flat" })) }] };
const deps = () => {
  const puts = [];
  return {
    puts,
    sleep: async () => {},
    fetchImage: async () => ({ bytes: new ArrayBuffer(8), contentType: "image/jpeg" }),
    putBlob: async (p) => { puts.push(p); return `https://blob.example/${p}`; },
  };
};
{
  const calls = stubFetch([
    ["/store/variants/555", () => json(syncVariant)],
    ["/v2/catalog-products/71/mockup-styles", () => json(styles)],
    ["/v2/mockup-tasks?id=", () => json({ data: [{ id: 99, status: "completed", catalog_variant_mockups: [{ mockups: [1, 2, 3, 4, 5, 6].map((n) => ({ mockup_url: `https://tmp.example/${n}.jpg` })) }] }] })],
    ["/v2/mockup-tasks", () => json({ data: [{ id: 99, status: "pending" }] })],
  ]);
  const d = deps();
  const r = await mockupStep({ itemId: "tee", syncVariantId: "555" }, d);
  t("mockups: done with 6 pictures kept once each", r.state === "done" && r.count === 6 && d.puts.length === 6 && !r.note);
  t("mockups: stored at the ruled path", d.puts[0] === "store/media/printful/tee/1.jpg" && d.puts[5] === "store/media/printful/tee/6.jpg");
  const create = JSON.parse(calls.find((c) => c.init.method === "POST" && c.url.endsWith("/v2/mockup-tasks")).init.body);
  const p = create.products[0];
  t("mockups: task asks model views first, uses the design file, skips the preview file",
    p.mockup_style_ids[0] === 4 && p.placements.length === 1 && p.placements[0].layers[0].url === "https://files.example/d.png" && p.placements[0].technique === "dtg");
}
{
  stubFetch([
    ["/store/variants/555", () => json(syncVariant)],
    ["/v2/catalog-products/71/mockup-styles", () => json(styles)],
    ["/v2/mockup-tasks?id=", () => json({ data: [{ id: 99, status: "completed", catalog_variant_mockups: [{ mockups: [{ mockup_url: "https://tmp.example/1.jpg" }, { mockup_url: "https://tmp.example/2.jpg" }] }] }] })],
    ["/v2/mockup-tasks", () => json({ data: [{ id: 99, status: "pending" }] })],
  ]);
  const r = await mockupStep({ itemId: "tee", syncVariantId: "555" }, deps());
  t("mockups: fewer than 5 is reported, not hidden", r.state === "done" && r.count === 2 && /only 2/.test(r.note));
}
{
  stubFetch([
    ["/v2/mockup-tasks?id=", () => json({ data: [{ id: 99, status: "pending" }] })],
  ]);
  const r = await mockupStep({ itemId: "tee", syncVariantId: "555", taskId: "v2:99" }, deps());
  t("mockups: still drawing returns pending with the task id", r.state === "pending" && r.taskId === "v2:99");
}
{
  stubFetch([
    ["/store/variants/555", () => json(syncVariant)],
    ["/v2/catalog-products/71/mockup-styles", () => json(styles)],
    ["/v2/mockup-tasks", () => new Response("slow down", { status: 429, headers: { "retry-after": "42" } })],
  ]);
  const r = await mockupStep({ itemId: "tee", syncVariantId: "555" }, deps());
  t("mockups: 429 comes back as rate_limited with the wait", r.state === "rate_limited" && r.waitSec === 42);
}
{
  stubFetch([
    ["/store/variants/555", () => json(syncVariant)],
    ["/v2/catalog-products/71/mockup-styles", () => new Response("nope", { status: 404 })],
    ["/mockup-generator/create-task/71", () => json({ result: { task_key: "gt-1", status: "pending" } })],
    ["/mockup-generator/task?task_key=gt-1", () => json({ result: { status: "completed", mockups: [{ mockup_url: "https://tmp.example/a.jpg", extra: [{ url: "https://tmp.example/b.jpg" }] }] } })],
  ]);
  const d = deps();
  const r = await mockupStep({ itemId: "tee", syncVariantId: "555" }, d);
  t("mockups: v1 fallback when v2 styles are not available", r.state === "done" && r.count === 2);
}
{
  stubFetch([["/store/variants/555", () => json(syncVariant)], ["/v2/catalog-products/71/mockup-styles", () => new Response("x", { status: 500 })]]);
  const r = await mockupStep({ itemId: "tee", syncVariantId: "555" }, deps());
  t("mockups: Printful error is an honest error, no key in it", r.state === "error" && !/test-key/.test(r.error));
}

{
  const groups = [{ placement: "front", technique: "digital", mockup_styles: [{ id: 1, category: "Flat" }, { id: 2, category: "Lifestyle", restricted_to_variants: [999] }, { id: 3, category: "Lifestyle", restricted_to_variants: [24966] }] }];
  const p1 = pickStyles(groups, ["front"], 8, 24966);
  t("styles: skips styles kept for other variants", p1.styleIds.join() === "3,1");
  const p2 = pickStyles(groups, ["front"], 8, 24966, [3]);
  t("styles: skips styles Printful refused", p2.styleIds.join() === "1");
  t("styles: reads the refused ids from Printful's 400", unavailableStyleIds('printful /v2/mockup-tasks 400 {"data":"Following `style_ids`: 27922, 28008 are not available for catalog variant: 24966').join() === "27922,28008");
}

console.log(`printful-api: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
