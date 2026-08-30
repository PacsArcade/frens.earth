/**
 * Drop-ship fulfillment harness (S6 ruling 6), ported from
 * vanilla-template's Lane C (docs/fulfillment-dropship.md there is the
 * runbook this rail follows). Everything OFFLINE by discipline: where a
 * real HTTP call would happen (Printful's draft/confirm/status endpoints),
 * a synthetic global.fetch stub stands in — no network call reaches
 * Printful from this repo, ever.
 *
 * Orders round-trip through the REAL dev-file order driver (no KV/Redis
 * configured in this sandbox) — every order this file creates is deleted
 * at the end so a re-run starts clean.
 *
 * Uses scripts/lib/ts-loose-resolve.mjs, a small Node module-customization
 * hook that teaches this offline runner to resolve the codebase's own
 * extensionless relative imports (Next.js's bundler already does this;
 * Node's plain ESM loader does not).
 *
 * Run from the repo root:  node scripts/dropship-lane-c.test.mjs
 */

import path from "path";
import { rm } from "fs/promises";
import { registerHooks } from "node:module";
import { resolve as resolveTsLoose } from "./lib/ts-loose-resolve.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);

registerHooks({ resolve: resolveTsLoose });

// clean slate — no partner/KV env leaking in from the shell
delete process.env.PRINTFUL_API_KEY;
delete process.env.PRINTFUL_STORE_ID;
delete process.env.PRINTFUL_WEBHOOK_SECRET;
delete process.env.FOURTHWALL_API_TOKEN;
delete process.env.FOURTHWALL_API_KEY;
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.REDIS_URL;

const {
  recipientFromShipping,
  variantIdForLine,
  buildPrintfulOrderBody,
  mapPrintfulStatus,
  verifyPrintfulWebhookKey,
  parsePrintfulWebhookBody,
  printfulConfigured,
  createDraftOrder,
  confirmOrder,
  fetchOrderStatus,
} = await import(path.join(root, "src", "lib", "printful.ts"));
const { fourthwallConfigured, fourthwallBridgeNote } = await import(path.join(root, "src", "lib", "fourthwall.ts"));
const {
  hasStructuredAddress,
  settleDropshipFromOrder,
  confirmDropship,
  applyDropshipStatus,
} = await import(path.join(root, "src", "lib", "dropship.ts"));
const { upsertItem, removeItem, createOrder, getOrder, newOrderId } = await import(path.join(root, "src", "lib", "store.ts"));

let passed = 0, failed = 0;
function t(name, cond, extra = "") {
  if (cond) { passed++; }
  else { failed++; console.log(`FAIL  ${name}${extra ? ` — ${extra}` : ""}`); }
}

const createdOrderIds = [];
const createdItemIds = [];

async function makeOrder(overrides = {}) {
  const id = newOrderId();
  const order = {
    id,
    schemaVersion: 2,
    state: "created",
    lineItems: [{ itemId: "lane-c-item", title: "Lane C Test Tee", qty: 1, size: "M" }],
    priceSnapshot: { amount: 30_000, currency: "SATS", at: new Date().toISOString() },
    adapterId: "btcpay",
    chargeIds: ["lane-c:0"],
    createdAtMs: Date.now(),
    events: [],
    ...overrides,
  };
  await createOrder(order);
  createdOrderIds.push(id);
  return order;
}

async function makeItem(overrides = {}) {
  const id = overrides.id ?? "lane-c-item";
  const item = {
    id,
    schemaVersion: 2,
    title: "Lane C Test Tee",
    blurb: "test fixture",
    images: [],
    media: { images: [] },
    kind: "self",
    price: { sats: 30_000 },
    fulfillment: "self",
    status: "live",
    sizes: ["M"],
    ...overrides,
  };
  await upsertItem(item);
  createdItemIds.push(id);
  return item;
}

// ── recipientFromShipping — pure ───────────────────────────────────────
t("recipientFromShipping: complete address builds a recipient",
  recipientFromShipping({ name: "Ada", address1: "1 Main St", city: "Denver", country: "US", state: "CO", zip: "80201" })?.country_code === "US");
t("recipientFromShipping: missing address1 refuses honestly",
  recipientFromShipping({ name: "Ada", city: "Denver", country: "US" }) === null);
t("recipientFromShipping: missing country refuses honestly",
  recipientFromShipping({ name: "Ada", address1: "1 Main St", city: "Denver" }) === null);
t("recipientFromShipping: undefined shipping refuses honestly", recipientFromShipping(undefined) === null);

// ── variantIdForLine — pure ─────────────────────────────────────────────
const sizedItem = { partnerVariantIds: { S: "s-id", M: "m-id" } };
t("variantIdForLine: sized match", variantIdForLine(sizedItem, "M") === "m-id");
t("variantIdForLine: no mapping for that size and no default", variantIdForLine(sizedItem, "L") === null);
t("variantIdForLine: sizeless item falls back to the \"\" key",
  variantIdForLine({ partnerVariantIds: { "": "one-id" } }, undefined) === "one-id");
t("variantIdForLine: no map at all", variantIdForLine({}, "M") === null);

// ── buildPrintfulOrderBody — pure, the draft-not-spend contract ────────
{
  const order = { id: "ord123" };
  const recipient = { name: "Ada", address1: "1 Main St", city: "Denver", country_code: "US" };
  const body = buildPrintfulOrderBody(order, recipient, [{ sync_variant_id: "m-id", quantity: 1 }]);
  t("buildPrintfulOrderBody: confirm is FALSE (draft, never auto-spend)", body.confirm === false);
  t("buildPrintfulOrderBody: external_id carries our order id", body.external_id === "ord123");
  t("buildPrintfulOrderBody: recipient rides through unmodified", body.recipient === recipient);
  t("buildPrintfulOrderBody: items ride through", body.items.length === 1 && body.items[0].sync_variant_id === "m-id");
}

// ── mapPrintfulStatus — pure mapping table ──────────────────────────────
t("mapPrintfulStatus: draft", mapPrintfulStatus("draft") === "draft");
t("mapPrintfulStatus: pending family", mapPrintfulStatus("inprocess") === "pending");
t("mapPrintfulStatus: shipped", mapPrintfulStatus("shipped") === "shipped");
t("mapPrintfulStatus: canceled", mapPrintfulStatus("canceled") === "canceled");
t("mapPrintfulStatus: unrecognized never guessed", mapPrintfulStatus("some-new-status") === "unknown");
t("mapPrintfulStatus: undefined never guessed", mapPrintfulStatus(undefined) === "unknown");

// ── verifyPrintfulWebhookKey — the URL-secret honest gate ──────────────
delete process.env.PRINTFUL_WEBHOOK_SECRET;
t("verifyPrintfulWebhookKey: no secret configured refuses everything", verifyPrintfulWebhookKey("anything") === false);
process.env.PRINTFUL_WEBHOOK_SECRET = "s3cret-key-value";
t("verifyPrintfulWebhookKey: correct key passes", verifyPrintfulWebhookKey("s3cret-key-value") === true);
t("verifyPrintfulWebhookKey: wrong key refuses", verifyPrintfulWebhookKey("wrong-key-value") === false);
t("verifyPrintfulWebhookKey: null key refuses", verifyPrintfulWebhookKey(null) === false);
t("verifyPrintfulWebhookKey: different-length key refuses (no length oracle crash)", verifyPrintfulWebhookKey("short") === false);
delete process.env.PRINTFUL_WEBHOOK_SECRET;

// ── parsePrintfulWebhookBody — pure, no invented event types ────────────
t("parsePrintfulWebhookBody: package_shipped maps to shipped + tracking",
  (() => {
    const e = parsePrintfulWebhookBody({ type: "package_shipped", data: { order: { id: 555, shipment: { tracking_number: "1Z", tracking_url: "https://track" } } } });
    return e?.partnerOrderId === "555" && e.status === "shipped" && e.trackingNumber === "1Z";
  })());
t("parsePrintfulWebhookBody: order_failed maps to failed",
  parsePrintfulWebhookBody({ type: "order_failed", data: { order: { id: 1 } } })?.status === "failed");
t("parsePrintfulWebhookBody: order_canceled maps to canceled",
  parsePrintfulWebhookBody({ type: "order_canceled", data: { order: { id: 1 } } })?.status === "canceled");
t("parsePrintfulWebhookBody: unrecognized type returns null (never guessed)",
  parsePrintfulWebhookBody({ type: "something_else", data: { order: { id: 1 } } }) === null);
t("parsePrintfulWebhookBody: no order id returns null", parsePrintfulWebhookBody({ type: "package_shipped", data: {} }) === null);
t("parsePrintfulWebhookBody: garbage input returns null", parsePrintfulWebhookBody(null) === null && parsePrintfulWebhookBody("x") === null);

// ── printfulConfigured — env gate ───────────────────────────────────────
delete process.env.PRINTFUL_API_KEY;
t("printfulConfigured: false with no key", printfulConfigured() === false);
process.env.PRINTFUL_API_KEY = "fake-key-for-test";
t("printfulConfigured: true once the key is set", printfulConfigured() === true);

// ── createDraftOrder / confirmOrder / fetchOrderStatus — stubbed fetch ──
{
  const realFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    if (String(url).endsWith("/orders")) {
      return { ok: true, json: async () => ({ result: { id: 999 } }) };
    }
    if (String(url).endsWith("/orders/999/confirm")) {
      return { ok: true, json: async () => ({}) };
    }
    if (String(url).endsWith("/orders/999")) {
      return {
        ok: true,
        json: async () => ({ result: { status: "shipped", shipments: [{ tracking_number: "1Z999", tracking_url: "https://track/1Z999" }] } }),
      };
    }
    return { ok: false, status: 404, text: async () => "not found" };
  };

  const order = { id: "ord-stub" };
  const recipient = { name: "Ada", address1: "1 Main St", city: "Denver", country_code: "US" };
  const draft = await createDraftOrder(order, recipient, [{ sync_variant_id: "m-id", quantity: 1 }]);
  t("createDraftOrder: success returns the partner order id", draft.ok === true && draft.partnerOrderId === "999");
  t("createDraftOrder: posts to /orders with the draft (confirm:false) body",
    calls.some((c) => c.url.endsWith("/orders") && JSON.parse(c.init.body).confirm === false));

  const confirmed = await confirmOrder("999");
  t("confirmOrder: success", confirmed.ok === true);
  t("confirmOrder: posts to /orders/{id}/confirm", calls.some((c) => c.url.endsWith("/orders/999/confirm") && c.init.method === "POST"));

  const status = await fetchOrderStatus("999");
  t("fetchOrderStatus: maps to shipped with tracking", status.status === "shipped" && status.trackingNumber === "1Z999");

  global.fetch = async () => ({ ok: false, status: 500, text: async () => "boom" });
  const failedDraft = await createDraftOrder(order, recipient, [{ sync_variant_id: "m-id", quantity: 1 }]);
  t("createDraftOrder: a partner failure returns a reason, never throws", failedDraft.ok === false && typeof failedDraft.error === "string");

  global.fetch = realFetch;
}
delete process.env.PRINTFUL_API_KEY;

// ── fourthwall.ts — the honest subset ───────────────────────────────────
delete process.env.FOURTHWALL_API_TOKEN;
delete process.env.FOURTHWALL_API_KEY;
t("fourthwallConfigured: false with nothing set", fourthwallConfigured() === false);
process.env.FOURTHWALL_API_TOKEN = "fake-token";
t("fourthwallConfigured: true once a token is set", fourthwallConfigured() === true);
delete process.env.FOURTHWALL_API_TOKEN;
t("fourthwallBridgeNote: with a product link points at it", fourthwallBridgeNote(true).includes("product link"));
t("fourthwallBridgeNote: without one asks for one", fourthwallBridgeNote(false).includes("add one"));

// ── dropship.ts — hasStructuredAddress, pure ────────────────────────────
t("hasStructuredAddress: complete", hasStructuredAddress({ name: "Ada", address1: "1 Main St", city: "Denver", country: "US" }) === true);
t("hasStructuredAddress: missing city", hasStructuredAddress({ name: "Ada", address1: "1 Main St", country: "US" }) === false);
t("hasStructuredAddress: undefined", hasStructuredAddress(undefined) === false);
t("hasStructuredAddress: legacy free-text alone isn't structured", hasStructuredAddress({ name: "Ada", address: "1 Main St, Denver CO" }) === false);

// ── settleDropshipFromOrder — the real order-store round trip ──────────
await makeItem({ id: "lane-c-item", partner: "printful" }); // no partnerVariantIds yet

{
  // 1) Printful not configured → draft_pending, honest reason
  delete process.env.PRINTFUL_API_KEY;
  const order = await makeOrder({ state: "settled", shipping: { name: "Ada", address1: "1 Main St", city: "Denver", country: "US" } });
  const result = await settleDropshipFromOrder(order);
  t("settleDropshipFromOrder: Printful unconfigured → draft_pending", result.state === "draft_pending");
  const persisted = await getOrder(order.id);
  t("settleDropshipFromOrder: persisted honestly on the order", persisted.dropship?.state === "draft_pending" && !!persisted.dropship.lastError);
}

{
  // 2) Printful configured, incomplete address → draft_failed, no network call needed
  process.env.PRINTFUL_API_KEY = "fake-key-for-test";
  const order = await makeOrder({ state: "settled", shipping: { name: "Ada" } });
  const result = await settleDropshipFromOrder(order);
  t("settleDropshipFromOrder: incomplete address → draft_failed", result.state === "draft_failed");
  t("settleDropshipFromOrder: incomplete address reason is honest", result.note?.includes("incomplete address"));
}

{
  // 3) Printful configured, complete address, NO variant mapping → draft_failed
  const order = await makeOrder({ state: "settled", shipping: { name: "Ada", address1: "1 Main St", city: "Denver", country: "US" } });
  const result = await settleDropshipFromOrder(order);
  t("settleDropshipFromOrder: no variant mapping → draft_failed", result.state === "draft_failed");
  t("settleDropshipFromOrder: no variant mapping reason names the item", result.note?.includes("variant mapping"));
}

{
  // 4) Printful configured, complete address + mapping, stubbed fetch success → draft_created
  await makeItem({ id: "lane-c-item", partner: "printful", partnerVariantIds: { M: "m-id" } });
  const realFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).endsWith("/orders")) return { ok: true, json: async () => ({ result: { id: 42 } }) };
    return { ok: false, status: 404, text: async () => "unexpected" };
  };
  const order = await makeOrder({ state: "settled", shipping: { name: "Ada", address1: "1 Main St", city: "Denver", country: "US" } });
  const result = await settleDropshipFromOrder(order);
  t("settleDropshipFromOrder: full happy path → draft_created", result.state === "draft_created");
  const persisted = await getOrder(order.id);
  t("settleDropshipFromOrder: partnerOrderId persisted", persisted.dropship?.partnerOrderId === "42");

  // idempotent — a second call on an order past draft_pending is a no-op
  const again = await settleDropshipFromOrder(persisted);
  t("settleDropshipFromOrder: idempotent once past draft_pending", again.ran === false);
  global.fetch = realFetch;

  // 5) confirmDropship — the one door that spends
  global.fetch = async (url) => {
    if (String(url).endsWith("/orders/42/confirm")) return { ok: true, json: async () => ({}) };
    return { ok: false, status: 404, text: async () => "unexpected" };
  };
  const confirmed = await confirmDropship(persisted);
  t("confirmDropship: success → submitted", confirmed.state === "submitted");
  const afterConfirm = await getOrder(order.id);
  t("confirmDropship: persisted", afterConfirm.dropship?.state === "submitted");
  const reconfirm = await confirmDropship(afterConfirm);
  t("confirmDropship: refuses a second confirm on an already-submitted order", reconfirm.state === "submitted" && reconfirm.ran === false);
  global.fetch = realFetch;

  // 6) applyDropshipStatus shipped → tracking + order flips to fulfilled
  const shippedResult = await applyDropshipStatus(afterConfirm, { status: "shipped", trackingNumber: "1Z1", trackingUrl: "https://t" });
  t("applyDropshipStatus: shipped", shippedResult.state === "shipped");
  const finalOrder = await getOrder(order.id);
  t("applyDropshipStatus: order.state flips to fulfilled via the ONE sanctioned function", finalOrder.state === "fulfilled");
  t("applyDropshipStatus: tracking persisted", finalOrder.dropship?.trackingNumber === "1Z1");
}

{
  // 7) refunded after submit → cancel_needed, never silent
  const order = await makeOrder({ state: "refunded", dropship: { partner: "printful", state: "submitted", partnerOrderId: "7", createdAtMs: Date.now(), updatedAtMs: Date.now() } });
  const result = await settleDropshipFromOrder(order);
  t("settleDropshipFromOrder: refunded after submit → cancel_needed", result.state === "cancel_needed");
  t("settleDropshipFromOrder: cancel_needed note is loud, not silent", result.note?.toLowerCase().includes("cancel"));
}

{
  // 8) Fourthwall — manual bridge, never draft_created
  await makeItem({ id: "lane-c-fourthwall-item", partner: "fourthwall", partnerProductUrl: "https://x.fourthwall.com/products/tee" });
  process.env.FOURTHWALL_API_TOKEN = "fake-token";
  const order = await makeOrder({
    state: "settled",
    lineItems: [{ itemId: "lane-c-fourthwall-item", title: "Lane C Fourthwall Tee", qty: 1 }],
    shipping: { name: "Ada", address: "1 Main St, Denver CO" },
  });
  const result = await settleDropshipFromOrder(order);
  t("settleDropshipFromOrder: Fourthwall → manual_bridge, never automated", result.state === "manual_bridge");
  delete process.env.FOURTHWALL_API_TOKEN;
}

{
  // 9) no partner line at all → honest no-op
  await makeItem({ id: "lane-c-plain-item", partner: undefined });
  const order = await makeOrder({ state: "settled", lineItems: [{ itemId: "lane-c-plain-item", title: "Plain item", qty: 1 }] });
  const result = await settleDropshipFromOrder(order);
  t("settleDropshipFromOrder: no partner line → honest no-op", result.ran === false && result.note?.includes("no partner"));
}

delete process.env.PRINTFUL_API_KEY;

// ── cleanup — leave the dev-file driver pristine, same as rails-lane-d ──
for (const id of createdOrderIds) {
  await rm(path.join(root, "data", "store-orders", `${id}.json`), { force: true });
}
for (const id of createdItemIds) {
  await removeItem(id);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
