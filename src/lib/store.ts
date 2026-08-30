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

/**
 * v2 media block. `images` are PRODUCT SHOTS — public by nature, public
 * URLs are correct. `deliverable` describes the paid digital good:
 * { kind, label } are public listing metadata; `blobPath` is the PRIVATE
 * pointer to the paid file itself (a `store/deliverables/` blob pathname
 * in prod — random-suffixed, unguessable — or a `deliverables/` name under
 * data/ on the dev driver). See THE LEAK RULE on stripPrivateMedia().
 */
export interface ItemMedia {
  images: string[];
  /** optional public teaser URL (a clip, a sample) — never the paid good */
  preview?: string;
  deliverable?: {
    kind: "audio" | "video" | "file";
    label: string;
    /** PRIVATE pointer to the paid file — leak rule: stripPrivateMedia() */
    blobPath?: string;
  };
}

/**
 * ⛔ THE LEAK RULE — `deliverable.blobPath` is the private pointer to the
 * paid file and must NEVER appear in any public response: not the catalog
 * API, not an item page's server props, not the buyer's order view. Every
 * public serialization of an item funnels through this helper. The only
 * surface allowed to carry the path is the operator-gated /api/admin/store
 * GET (the artist editing their own shelf). A buyer reaches the file
 * exclusively through /api/store/download/[orderId] — the order id is the
 * capability; the path stays server-side.
 *
 * `partnerVariantIds` rides the same rule (drop-ship rail, S6 ruling 6) — a
 * Printful sync-variant-id is operational plumbing, not a secret, but it has
 * no reason on a public response either; same operator-gated-only surface
 * (/api/admin/store).
 */
export function stripPrivateMedia(item: StoreItem): StoreItem {
  const media = item.media;
  const d = media?.deliverable;
  const hasBlobPath = media && d && d.blobPath != null;
  const hasVariantIds = item.partnerVariantIds != null;
  if (!hasBlobPath && !hasVariantIds) return item;
  const next: StoreItem = { ...item };
  if (hasBlobPath) next.media = { ...media!, deliverable: { kind: d!.kind, label: d!.label } };
  if (hasVariantIds) delete next.partnerVariantIds;
  return next;
}

export interface StoreItem {
  id: string;
  schemaVersion: 2;
  title: string;
  blurb: string;
  /** legacy v1 field — mirrored from media.images so old readers keep working */
  images: string[];
  /** artist-entered item number */
  sku?: string;
  /** size/variant labels (S/M/L/XL or custom) — presence makes size required at checkout */
  sizes?: string[];
  media?: ItemMedia;
  kind: ItemKind;
  price: Price;
  /** sale price rides the gold rail; presence = on sale */
  sale?: Price;
  fulfillment: ItemKind;
  /** drop-ship partner filling the order (Printful / Fourthwall) — the
      admin UI only offers a partner once its API env is configured */
  partner?: "printful" | "fourthwall";
  /**
   * The PARTNER's own catalog identifier(s) this item maps to (drop-ship
   * rail, S6 ruling 6). Printful's Orders API needs a `sync_variant_id` per
   * line — keyed by this item's size label, or by "" when the item has no
   * sizes. Absent = the item can be listed and even sold, but a real
   * drop-ship order can never be PLACED for it — dropship.ts refuses
   * honestly ("no Printful variant mapping") instead of guessing one.
   */
  partnerVariantIds?: Record<string, string>;
  /**
   * Fourthwall's public API has no confirmed order-submission endpoint for
   * orders originated elsewhere — see docs/fulfillment-dropship.md. A
   * Fourthwall-partnered item gets a MANUAL bridge in v1: this is the
   * product's own Fourthwall page, shown on the admin desk as a direct
   * link, never auto-submitted anywhere.
   */
  partnerProductUrl?: string;
  status: ItemStatus;
  entitlementTier?: string;
}

/**
 * DROP-SHIP FULFILLMENT (S6 ruling 6, ported from vanilla-template's Lane
 * C): the state machine an order's `dropship` field walks through once it
 * carries a partner-fulfilled line. `draft_pending`/`draft_created`/
 * `draft_failed` never spend anything — Printful drafts are free to hold.
 * `submitted` is the ONE state an operator reaches on purpose (the
 * confirm-to-submit door in the admin desk) — that is the moment real
 * fulfillment (and the artist's Printful balance) is touched. `shipped`
 * carries tracking once the partner reports it; the order's own `state`
 * flips to "fulfilled" at the same moment (markFulfilled) so the artist
 * never has two different fulfillment stories to reconcile.
 */
export type DropshipState =
  | "draft_pending" // partner not configured yet, or the draft call hasn't run
  | "draft_created" // a draft exists at the partner — awaiting operator confirm
  | "draft_failed" // the partner refused the draft — retryable
  | "submitted" // operator confirmed — real fulfillment requested
  | "submit_failed" // the confirm call failed — retryable
  | "shipped" // the partner reports it left the building
  | "manual_bridge" // no verified order-submission API (Fourthwall v1) — human re-enters it
  | "cancel_needed"; // the order was refunded/disputed AFTER a submit — needs a human cancel

export interface DropshipRecord {
  partner: "printful" | "fourthwall";
  state: DropshipState;
  partnerOrderId?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  /** why the last attempt didn't land — never a silent retry-forever */
  lastError?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

/** What a v1 record on disk/blob may look like — read-compat input shape. */
type StoredItem = Omit<StoreItem, "schemaVersion"> & { schemaVersion: 1 | 2 };

/** Read-compat: v1 records upgrade in memory on every read; writes are v2. */
function migrateItem(raw: StoredItem): StoreItem {
  const media: ItemMedia = raw.media ?? { images: raw.images ?? [] };
  return { ...raw, schemaVersion: 2, media, images: media.images };
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
  /** 1 = pre-sizes records (read-compat: size is optional); new orders write 2 */
  schemaVersion: 1 | 2;
  state: OrderState;
  lineItems: { itemId: string; title: string; qty: number; size?: string }[];
  priceSnapshot: PriceSnapshot;
  adapterId: string;
  /** one order, many charges — invoices expire and get re-minted */
  chargeIds: string[];
  /** handle@space — REQUIRED for digital/package (the gate's subject) */
  entitlementSubject?: string;
  contact?: { email?: string };
  /**
   * `address` is the ORIGINAL free-text field — still what a self-fulfilled
   * ("the artist packs it") item collects. A drop-ship PARTNER item (S6
   * ruling 6) additionally needs STRUCTURED fields — Printful's Orders API
   * wants address1/city/state/zip/country as separate values, not one blob
   * to parse apart. Both may be present; dropship.ts reads only the
   * structured half and refuses honestly if it's incomplete rather than
   * guessing a split of `address`.
   */
  shipping?: {
    name?: string;
    address?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    /** ISO-3166-1 alpha-2, e.g. "US" — required for a partner order */
    country?: string;
    phone?: string;
  };
  /**
   * Drop-ship fulfillment state (S6 ruling 6) — set the moment an order
   * carrying a partner-fulfilled line settles. A DRAFT costs the artist
   * nothing to create; only `state: "submitted"` (an operator's explicit
   * confirm click, never automatic) actually spends against the partner
   * account. Rides the order record itself — same private KV/dev-file
   * driver every other order field already uses, no new storage.
   */
  dropship?: DropshipRecord;
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
  /** doc version follows the item version; v1 docs read fine (item read-compat) */
  schemaVersion: 2;
  items: StoreItem[];
}

/** A doc as stored — may be v1 (items without sku/sizes/media). */
interface StoredCatalogDoc {
  schemaVersion: 1 | 2;
  items: StoredItem[];
}

/** Fresh each call — callers mutate the doc (upsert pushes into items). */
const emptyCatalog = (): CatalogDoc => ({ schemaVersion: 2, items: [] });

function migrateCatalog(doc: StoredCatalogDoc): CatalogDoc {
  return { schemaVersion: 2, items: doc.items.map(migrateItem) };
}

const CATALOG_BLOB = "store/catalog.json";
const catalogFile = () => path.join(process.cwd(), "data", "store-catalog.json");

async function readCatalog(): Promise<CatalogDoc> {
  if (blobStoreEnabled()) {
    try {
      const res = await get(CATALOG_BLOB, { access: "public" });
      if (res && res.statusCode === 200) {
        return migrateCatalog(JSON.parse(await new Response(res.stream).text()) as StoredCatalogDoc);
      }
    } catch {
      /* fall through to empty */
    }
    return emptyCatalog();
  }
  try {
    return migrateCatalog(JSON.parse(await fs.readFile(catalogFile(), "utf8")) as StoredCatalogDoc);
  } catch {
    return emptyCatalog();
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
  if (item.sku != null && (typeof item.sku !== "string" || item.sku.length > 64)) {
    return { ok: false, reason: "sku as short text (max 64 chars)" };
  }
  if (item.sizes != null) {
    if (
      !Array.isArray(item.sizes) ||
      item.sizes.length > 24 ||
      item.sizes.some((s) => typeof s !== "string" || !s.trim() || s.length > 32)
    ) {
      return { ok: false, reason: "sizes as up to 24 short labels" };
    }
  }
  if (item.media) {
    const m = item.media;
    if (!Array.isArray(m.images) || m.images.length > 12 || m.images.some((u) => typeof u !== "string" || !u)) {
      return { ok: false, reason: "media images as up to 12 URLs" };
    }
    if (m.preview != null && typeof m.preview !== "string") {
      return { ok: false, reason: "preview as a URL" };
    }
    if (m.deliverable) {
      if (!["audio", "video", "file"].includes(m.deliverable.kind) || !m.deliverable.label?.trim()) {
        return { ok: false, reason: "deliverable as kind (audio/video/file) + label" };
      }
      const bp = m.deliverable.blobPath;
      if (bp != null) {
        if (
          typeof bp !== "string" ||
          bp.length > 300 ||
          bp.includes("..") ||
          !(bp.startsWith("store/deliverables/") || bp.startsWith("deliverables/"))
        ) {
          return { ok: false, reason: "deliverable file path under store/deliverables/ (or the dev driver's deliverables/)" };
        }
      }
    }
  }
  if (item.partner != null && !["printful", "fourthwall"].includes(item.partner)) {
    return { ok: false, reason: "partner as printful or fourthwall" };
  }
  if (item.partnerVariantIds != null) {
    if (typeof item.partnerVariantIds !== "object" || Array.isArray(item.partnerVariantIds)) {
      return { ok: false, reason: "partnerVariantIds as a size → id map" };
    }
    for (const [size, id] of Object.entries(item.partnerVariantIds)) {
      if (size.length > 32 || typeof id !== "string" || !id.trim() || id.length > 128) {
        return { ok: false, reason: "partnerVariantIds entries as short size labels → non-empty partner ids" };
      }
    }
  }
  if (item.partnerProductUrl != null && (typeof item.partnerProductUrl !== "string" || item.partnerProductUrl.length > 500)) {
    return { ok: false, reason: "partnerProductUrl as a URL" };
  }
  return { ok: true };
}

export async function upsertItem(item: StoreItem): Promise<StoreItem> {
  const normalized = migrateItem(item); // keeps the legacy images mirror in sync
  const doc = await readCatalog();
  const i = doc.items.findIndex((x) => x.id === normalized.id);
  if (i >= 0) doc.items[i] = normalized;
  else doc.items.push(normalized);
  await writeCatalog(doc);
  return normalized;
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

/**
 * The vault speaks two transports, whichever the platform provisioned:
 * - REST (Upstash KV_REST_API_URL/TOKEN pair) when present;
 * - native Redis over TCP via REDIS_URL — the only thing the current
 *   Vercel marketplace hands out. Lazy singleton client, reused across
 *   warm invocations, dropped on error so the next call reconnects.
 */
function restEnv(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

function vaultConfigured(): boolean {
  return restEnv() !== null || !!process.env.REDIS_URL;
}

const kvKey = (id: string) => `store:order:${id}`;
const KV_INDEX = "store:orders:index";

type RedisLike = { sendCommand: (cmd: string[]) => Promise<unknown> };
let redisClient: RedisLike | null = null;

async function getRedis(): Promise<RedisLike> {
  if (redisClient) return redisClient;
  const { createClient } = await import("redis");
  const client = createClient({
    url: process.env.REDIS_URL,
    socket: { connectTimeout: 5000 },
  });
  client.on("error", () => {
    redisClient = null; // next call reconnects instead of riding a dead socket
  });
  await client.connect();
  redisClient = client as unknown as RedisLike;
  return redisClient;
}

async function kv(cmd: unknown[]): Promise<{ result: unknown } | null> {
  if (!vaultConfigured()) return null;
  const rest = restEnv();
  if (rest) {
    const res = await fetch(rest.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${rest.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`order store: KV ${res.status}`);
    return (await res.json()) as { result: unknown };
  }
  try {
    const client = await getRedis();
    const result = await client.sendCommand(cmd.map(String));
    return { result };
  } catch (err) {
    redisClient = null;
    throw new Error(`order store: redis ${err instanceof Error ? err.message : "error"}`);
  }
}

/** Prod requires the vault; dev uses files. False = checkout honestly refuses. */
export function ordersConfigured(): boolean {
  if (process.env.VERCEL === "1") return vaultConfigured();
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
  if (vaultConfigured()) {
    const res = await kv(["SET", kvKey(order.id), JSON.stringify(order), "NX"]);
    if (res?.result === null) throw new Error("order store: id collision");
    await kv(["SADD", KV_INDEX, order.id]);
    return;
  }
  await fs.mkdir(ordersDir(), { recursive: true });
  await fs.writeFile(orderFile(order.id), JSON.stringify(order, null, 2), { flag: "wx" });
}

async function writeOrder(order: OrderRecord): Promise<void> {
  if (vaultConfigured()) {
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
  if (vaultConfigured()) {
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
  if (vaultConfigured()) {
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

/**
 * The one write path for `order.dropship` (S6 ruling 6) — re-read, mutate
 * the one field, write back. Callers pass the fields that changed;
 * `partner`/`createdAtMs` persist across calls once set. Never flips
 * `order.state` itself — a "shipped" dropship state pairs with a SEPARATE
 * `markFulfilled()` call so the fulfilled flip always runs through its one
 * sanctioned function.
 */
export async function setDropship(
  orderId: string,
  patch: { partner: DropshipRecord["partner"]; state: DropshipRecord["state"] } & Partial<
    Omit<DropshipRecord, "partner" | "state" | "createdAtMs" | "updatedAtMs">
  >,
): Promise<OrderRecord | null> {
  const order = await getOrder(orderId);
  if (!order) return null;
  const now = Date.now();
  const existing = order.dropship;
  order.dropship = {
    ...existing,
    ...patch,
    createdAtMs: existing?.createdAtMs ?? now,
    updatedAtMs: now,
  };
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
