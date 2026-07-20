import { promises as fs } from "fs";
import path from "path";
import { put, get } from "@vercel/blob";
import { blobStoreEnabled } from "./registry";

/**
 * The store — catalog + orders (spec: docs/storefront-framework.md, S1).
 *
 * Storage:
 * - CATALOG: public by nature → the house dual-driver single-doc pattern
 *   (data/store-catalog.json in dev, store/catalog.json blob in prod;
 *   last-write-wins is an accepted, documented trade for a single operator).
 * - ORDERS: PII — the private-driver mandate applies. One record per order,
 *   create-if-not-exists (the registry.ts atomicity pattern), never in a
 *   public blob: files under data/store-orders/ in dev, KV (Upstash REST)
 *   in prod. No KV configured in prod → orders are honestly NOT configured
 *   and checkout refuses, it never falls back to public storage.
 * - recordChargeEvent() is the ONE sanctioned state flip — webhook and
 *   reconcile polling both funnel through it; retries are no-ops.
 */

export type ItemKind = "self" | "fourthwall" | "digital" | "service" | "package";
export type ItemStatus = "live" | "hidden" | "soldout";

export interface Price {
  /** integer sats */
  sats?: number;
  /** integer minor units + ISO-4217 — the exact shape Square/Stripe demand */
  fiat?: { amount: number; currency: string };
}

export interface StoreItem {
  id: string;
  schemaVersion: 1;
  title: string;
  blurb: string;
  images: string[];
  kind: ItemKind;
  price: Price;
  /** sale price rides the gold rail; presence = on sale */
  sale?: Price;
  fulfillment: ItemKind;
  status: ItemStatus;
  entitlementTier?: string;
}

export type OrderState =
  | "created"
  | "charge_created"
  | "processing"
  | "settled"
  | "fulfilled"
  | "expired"
  | "underpaid"
  | "canceled"
  | "refunded"
  | "disputed";

/** Terminal-ish states a plain charge event may never downgrade. */
const SETTLED_FAMILY: OrderState[] = ["settled", "fulfilled", "refunded", "disputed"];

export interface PriceSnapshot {
  amount: number;
  currency: string; // "SATS" or ISO-4217
  rate?: number;
  rateSource?: string;
  at: string; // ISO — raw record; surfaces render BFT with ~
}

export interface OrderRecord {
  id: string;
  schemaVersion: 1;
  state: OrderState;
  lineItems: { itemId: string; title: string; qty: number }[];
  priceSnapshot: PriceSnapshot;
  adapterId: string;
  /** one order, many charges — invoices expire and get re-minted */
  chargeIds: string[];
  /** handle@space — REQUIRED for digital/package (the gate's subject) */
  entitlementSubject?: string;
  contact?: { email?: string };
  shipping?: { name?: string; address?: string };
  createdAtMs: number;
  settledAtMs?: number;
  /** contact+shipping stripped on schedule (call #3) */
  piiPurgedAtMs?: number;
  events: { type: string; chargeId: string; atMs: number }[];
}

/** ~4,320 blocks ≈ 30 days: the returns window, then we forget on purpose. */
const PII_PURGE_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Catalog (dual-driver single doc)
// ---------------------------------------------------------------------------

interface CatalogDoc {
  schemaVersion: 1;
  items: StoreItem[];
}

const CATALOG_BLOB = "store/catalog.json";
const catalogFile = () => path.join(process.cwd(), "data", "store-catalog.json");

async function readCatalog(): Promise<CatalogDoc> {
  if (blobStoreEnabled()) {
    try {
      const res = await get(CATALOG_BLOB, { access: "public" });
      if (res && res.statusCode === 200) {
        return JSON.parse(await new Response(res.stream).text()) as CatalogDoc;
      }
    } catch {
      /* fall through to empty */
    }
    return { schemaVersion: 1, items: [] };
  }
  try {
    return JSON.parse(await fs.readFile(catalogFile(), "utf8")) as CatalogDoc;
  } catch {
    return { schemaVersion: 1, items: [] };
  }
}

async function writeCatalog(doc: CatalogDoc): Promise<void> {
  const json = JSON.stringify(doc, null, 2);
  if (blobStoreEnabled()) {
    await put(CATALOG_BLOB, json, {
      access: "public",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return;
  }
  await fs.mkdir(path.dirname(catalogFile()), { recursive: true });
  const tmp = catalogFile() + ".tmp";
  await fs.writeFile(tmp, json, "utf8");
  await fs.rename(tmp, catalogFile());
}

export async function listItems(opts?: { includeHidden?: boolean }): Promise<StoreItem[]> {
  const { items } = await readCatalog();
  return opts?.includeHidden ? items : items.filter((i) => i.status !== "hidden");
}

export async function getItem(id: string): Promise<StoreItem | null> {
  const { items } = await readCatalog();
  return items.find((i) => i.id === id) ?? null;
}

/** An item needs at least one denomination to go live (spec validity rule). */
export function validateItem(item: StoreItem): { ok: true } | { ok: false; reason: string } {
  if (!item.title?.trim()) return { ok: false, reason: "a title" };
  if (item.status === "live" && item.price.sats == null && item.price.fiat == null) {
    return { ok: false, reason: "at least one price (sats or fiat) before going live" };
  }
  if (item.price.sats != null && (!Number.isInteger(item.price.sats) || item.price.sats <= 0)) {
    return { ok: false, reason: "sats as a positive integer" };
  }
  if (item.price.fiat && (!Number.isInteger(item.price.fiat.amount) || !/^[A-Z]{3}$/.test(item.price.fiat.currency))) {
    return { ok: false, reason: "fiat as integer minor units + ISO-4217 code" };
  }
  return { ok: true };
}

export async function upsertItem(item: StoreItem): Promise<StoreItem> {
  const doc = await readCatalog();
  const i = doc.items.findIndex((x) => x.id === item.id);
  if (i >= 0) doc.items[i] = item;
  else doc.items.push(item);
  await writeCatalog(doc);
  return item;
}

export async function removeItem(id: string): Promise<boolean> {
  const doc = await readCatalog();
  const before = doc.items.length;
  doc.items = doc.items.filter((x) => x.id !== id);
  if (doc.items.length === before) return false;
  await writeCatalog(doc);
  return true;
}

// ---------------------------------------------------------------------------
// Orders (private driver: dev files / prod KV — never public blob)
// ---------------------------------------------------------------------------

const ordersDir = () => path.join(process.cwd(), "data", "store-orders");
const orderFile = (id: string) => path.join(ordersDir(), `${id}.json`);

function kvEnv(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

const kvKey = (id: string) => `store:order:${id}`;
const KV_INDEX = "store:orders:index";

async function kv(cmd: unknown[]): Promise<{ result: unknown } | null> {
  const env = kvEnv();
  if (!env) return null;
  const res = await fetch(env.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`order store: KV ${res.status}`);
  return (await res.json()) as { result: unknown };
}

/** Prod requires KV; dev uses files. False = checkout honestly refuses. */
export function ordersConfigured(): boolean {
  if (process.env.VERCEL === "1") return kvEnv() !== null;
  return true;
}

function safeOrderId(id: string): boolean {
  return /^[a-f0-9]{24}$/.test(id);
}

export function newOrderId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Create-if-not-exists — the atomicity the money path requires. */
export async function createOrder(order: OrderRecord): Promise<void> {
  if (!safeOrderId(order.id)) throw new Error("order store: bad id");
  if (kvEnv()) {
    const res = await kv(["SET", kvKey(order.id), JSON.stringify(order), "NX"]);
    if (res?.result === null) throw new Error("order store: id collision");
    await kv(["SADD", KV_INDEX, order.id]);
    return;
  }
  await fs.mkdir(ordersDir(), { recursive: true });
  await fs.writeFile(orderFile(order.id), JSON.stringify(order, null, 2), { flag: "wx" });
}

async function writeOrder(order: OrderRecord): Promise<void> {
  if (kvEnv()) {
    await kv(["SET", kvKey(order.id), JSON.stringify(order)]);
    return;
  }
  const tmp = orderFile(order.id) + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(order, null, 2), "utf8");
  await fs.rename(tmp, orderFile(order.id));
}

export async function getOrder(id: string): Promise<OrderRecord | null> {
  if (!safeOrderId(id)) return null;
  let order: OrderRecord | null = null;
  if (kvEnv()) {
    const res = await kv(["GET", kvKey(id)]);
    if (typeof res?.result === "string") order = JSON.parse(res.result) as OrderRecord;
  } else {
    try {
      order = JSON.parse(await fs.readFile(orderFile(id), "utf8")) as OrderRecord;
    } catch {
      order = null;
    }
  }
  if (order) order = await purgeIfDue(order);
  return order;
}

export async function listOrders(): Promise<OrderRecord[]> {
  const ids: string[] = [];
  if (kvEnv()) {
    const res = await kv(["SMEMBERS", KV_INDEX]);
    if (Array.isArray(res?.result)) ids.push(...(res.result as string[]));
  } else {
    try {
      for (const f of await fs.readdir(ordersDir())) {
        if (f.endsWith(".json")) ids.push(f.replace(/\.json$/, ""));
      }
    } catch {
      /* no orders yet — an honest empty list */
    }
  }
  const orders = await Promise.all(ids.map((id) => getOrder(id)));
  return (orders.filter(Boolean) as OrderRecord[]).sort((a, b) => b.createdAtMs - a.createdAtMs);
}

/** Call #3: forget contact/shipping on schedule. Applied on every read. */
async function purgeIfDue(order: OrderRecord): Promise<OrderRecord> {
  const done = order.state === "fulfilled" || order.state === "refunded";
  const since = order.settledAtMs ?? order.createdAtMs;
  if (!done || order.piiPurgedAtMs || Date.now() - since < PII_PURGE_MS) return order;
  const purged: OrderRecord = { ...order, contact: undefined, shipping: undefined, piiPurgedAtMs: Date.now() };
  await writeOrder(purged);
  return purged;
}

// ---------------------------------------------------------------------------
// The ONE sanctioned state flip
// ---------------------------------------------------------------------------

export type ChargeEventType =
  | "charge_created"
  | "processing"
  | "settled"
  | "expired"
  | "invalid"
  | "underpaid"
  | "refunded"
  | "disputed";

const EVENT_TO_STATE: Record<ChargeEventType, OrderState> = {
  charge_created: "charge_created",
  processing: "processing",
  settled: "settled",
  expired: "expired",
  invalid: "canceled",
  underpaid: "underpaid",
  refunded: "refunded",
  disputed: "disputed",
};

/**
 * Webhook and reconcile polling both land here — same guarantee, two
 * triggers. Idempotent: a retried event is a no-op; a plain charge event
 * never downgrades the settled family (only refund/dispute move it).
 */
export async function recordChargeEvent(
  orderId: string,
  ev: { type: ChargeEventType; chargeId: string }
): Promise<OrderRecord | null> {
  const order = await getOrder(orderId);
  if (!order) return null;
  if (!order.chargeIds.includes(ev.chargeId)) return order; // not our charge — ignore, never flip
  const next = EVENT_TO_STATE[ev.type];
  const already = order.events.some((e) => e.type === ev.type && e.chargeId === ev.chargeId);
  const downgrade = SETTLED_FAMILY.includes(order.state) && !["refunded", "disputed"].includes(ev.type);
  if (already || downgrade || order.state === next) return order;
  order.state = next;
  if (next === "settled") order.settledAtMs = Date.now();
  order.events.push({ type: ev.type, chargeId: ev.chargeId, atMs: Date.now() });
  await writeOrder(order);
  return order;
}

/** The artist's flip: settled → fulfilled (shipment sent / access granted). */
export async function markFulfilled(orderId: string): Promise<OrderRecord | null> {
  const order = await getOrder(orderId);
  if (!order) return null;
  if (order.state !== "settled") return order;
  order.state = "fulfilled";
  order.events.push({ type: "fulfilled", chargeId: "", atMs: Date.now() });
  await writeOrder(order);
  return order;
}

export async function attachCharge(orderId: string, chargeId: string): Promise<OrderRecord | null> {
  const order = await getOrder(orderId);
  if (!order) return null;
  if (!order.chargeIds.includes(chargeId)) {
    order.chargeIds.push(chargeId);
    order.state = "charge_created";
    order.events.push({ type: "charge_created", chargeId, atMs: Date.now() });
    await writeOrder(order);
  }
  return order;
}
