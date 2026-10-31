/**
 * Cart rules: line validation, merge, total math with qty, one shipper per
 * cart, digital refusal, and the old single-item request shape left alone.
 * OFFLINE: pure functions plus a source check of the checkout route.
 *
 * Run from the repo root:  node scripts/cart.test.mjs
 */
import path from "path";
import { readFileSync } from "fs";
import { registerHooks } from "node:module";
import { resolve as resolveTsLoose } from "./lib/ts-loose-resolve.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
registerHooks({ resolve: resolveTsLoose });

const { normalizeCartLines, resolveCart, cartSubtotal, orderLineItems, shipperOf } = await import(path.join(root, "src/lib/cart.ts"));
const { chargeWithShipping } = await import(path.join(root, "src/lib/printful-shipping.ts"));

let passed = 0, failed = 0;
function t(name, cond, extra = "") {
  if (cond) passed++;
  else { failed++; console.log(`FAIL  ${name}${extra ? ` - ${extra}` : ""}`); }
}

const item = (o) => ({
  id: "x", schemaVersion: 2, title: "X", blurb: "", images: [], kind: "self", fulfillment: "self",
  status: "live", price: { sats: 1000 }, ...o,
});
const tee = item({ id: "tee", title: "Tee", partner: "printful", sizes: ["S", "M"], price: { fiat: { amount: 2500, currency: "USD" } } });
const cap = item({ id: "cap", title: "Cap", partner: "printful", price: { fiat: { amount: 1800, currency: "USD" } } });
const mug = item({ id: "mug", title: "Mug", price: { fiat: { amount: 1200, currency: "USD" } } });
const pin = item({ id: "pin", title: "Pin", price: { sats: 5000 }, sale: { sats: 4000 } });
const song = item({ id: "song", title: "Song", kind: "digital", fulfillment: "digital" });
const pack = item({ id: "pack", title: "Pack", kind: "package", fulfillment: "package" });
const cat = new Map([tee, cap, mug, pin, song, pack].map((i) => [i.id, i]));
const resolve = (lines) => resolveCart(lines, cat);

// ---- line validation ----
t("empty cart refused", normalizeCartLines([]).ok === false);
t("non-array refused", normalizeCartLines("tee").ok === false);
t("11 lines refused", normalizeCartLines(Array.from({ length: 11 }, (_, i) => ({ itemId: `i${i}`, qty: 1 }))).ok === false);
t("10 lines fine", normalizeCartLines(Array.from({ length: 10 }, (_, i) => ({ itemId: `i${i}`, qty: 1 }))).ok === true);
t("qty 0 refused", normalizeCartLines([{ itemId: "tee", qty: 0 }]).ok === false);
t("qty 11 refused", normalizeCartLines([{ itemId: "tee", qty: 11 }]).ok === false);
t("qty 1.5 refused", normalizeCartLines([{ itemId: "tee", qty: 1.5 }]).ok === false);
t("qty string refused", normalizeCartLines([{ itemId: "tee", qty: "2" }]).ok === false);
t("missing itemId refused", normalizeCartLines([{ qty: 1 }]).ok === false);
{
  const m = normalizeCartLines([{ itemId: "tee", size: "M", qty: 2 }, { itemId: "tee", size: "M", qty: 3 }, { itemId: "tee", size: "S", qty: 1 }]);
  t("same item+size merged", m.ok && m.lines.length === 2 && m.lines[0].qty === 5);
  t("different size stays apart", m.ok && m.lines[1].size === "S");
}
t("merge past 10 refused", normalizeCartLines([{ itemId: "tee", size: "M", qty: 6 }, { itemId: "tee", size: "M", qty: 6 }]).ok === false);

// ---- catalog rules ----
t("unknown item refused", resolve([{ itemId: "nope", qty: 1 }]).ok === false);
t("hidden item refused", resolveCart([{ itemId: "tee", size: "S", qty: 1 }], new Map([["tee", { ...tee, status: "hidden" }]])).ok === false);
t("sold out refused", resolveCart([{ itemId: "tee", size: "S", qty: 1 }], new Map([["tee", { ...tee, status: "soldout" }]])).ok === false);
t("sized item without size refused", resolve([{ itemId: "tee", qty: 1 }]).ok === false);
t("sized item with bad size refused", resolve([{ itemId: "tee", size: "XXL", qty: 1 }]).ok === false);
t("size on an unsized item refused", resolve([{ itemId: "cap", size: "M", qty: 1 }]).ok === false);
{
  const r = resolve([{ itemId: "song", qty: 1 }]);
  t("digital refused", !r.ok && /own page/.test(r.reason));
  t("package refused", resolve([{ itemId: "pack", qty: 1 }]).ok === false);
  t("digital refused even beside valid lines", resolve([{ itemId: "cap", qty: 1 }, { itemId: "song", qty: 1 }]).ok === false);
}
{
  const r = resolve([{ itemId: "cap", qty: 1 }, { itemId: "mug", qty: 1 }]);
  t("printful + self-fulfilled refused", !r.ok && /separately/.test(r.reason));
  const ok = resolve([{ itemId: "tee", size: "S", qty: 1 }, { itemId: "cap", qty: 2 }]);
  t("two printful lines allowed", ok.ok && ok.shipper === "printful");
  t("self-only cart allowed", resolve([{ itemId: "mug", qty: 1 }]).shipper === "self");
}
t("sats + dollars refused", resolve([{ itemId: "pin", qty: 1 }, { itemId: "mug", qty: 1 }]).ok === false);
t("shipperOf", shipperOf(tee) === "printful" && shipperOf(mug) === "self");

// ---- total math ----
{
  const r = resolve([{ itemId: "tee", size: "M", qty: 3 }, { itemId: "cap", qty: 2 }]);
  const sub = cartSubtotal(r.lines);
  t("dollar subtotal = 3x2500 + 2x1800 = 11100", sub.fiat?.amount === 11100 && sub.fiat.currency === "USD");
  const sats = cartSubtotal(resolve([{ itemId: "pin", qty: 4 }]).lines);
  t("sats subtotal uses the SALE price: 4 x 4000", sats.sats === 16000);
  const charge = await chargeWithShipping(sub, { ok: true, amountMinor: 699, currency: "USD", method: "Flat" });
  t("fiat total = subtotal + shipping once", charge.ok && charge.amount === 11100 + 699 && charge.itemAmount === 11100 && charge.shippingAmount === 699);
  const cs = await chargeWithShipping(sats, { ok: true, amountMinor: 500, currency: "USD", method: "Flat" }, async (m) => m * 10);
  t("sats total = subtotal + shipping in sats", cs.ok && cs.amount === 16000 + 5000 && cs.currency === "SATS");
  const li = orderLineItems(r.lines);
  t("lineItems carry every line with qty and size", li.length === 2 && li[0].qty === 3 && li[0].size === "M" && li[1].itemId === "cap" && li[1].size === undefined);
}

// ---- the old single-item shape is still there, unchanged ----
{
  const src = readFileSync(path.join(root, "src/app/api/store/checkout/route.ts"), "utf8");
  t("route still reads body.itemId for the single path", /body\.itemId \? await getItem\(body\.itemId\)/.test(src));
  t("single path still writes qty 1", /qty: 1, size: item\.sizes\?\.length \? size : undefined/.test(src));
  t("cart path only on body.lines", /if \(body\.lines !== undefined\) return cartCheckout/.test(src));
  t("orderId re-charge shape kept", /if \(body\.orderId\)/.test(src));
}

console.log(`cart: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
