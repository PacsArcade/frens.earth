import { timingSafeEqual } from "crypto";
import type { OrderRecord, StoreItem } from "./store";

/**
 * Printful — the print-on-demand drop-ship rail (Lane C, S6 ruling 6:
 * "Printful/Fourthwall IN v1 — frens.earth needs it, onecocreation likely").
 * Mirrors payments.ts's own discipline for a NEW rail: one env-gated
 * `configured()` check, pure request-body builders split out for offline
 * unit testing, and every endpoint shape marked plainly where it hasn't
 * been exercised against a real Printful account from this sandbox.
 *
 * ⚠ FIRST-VERIFIED-BY-PAC'S-SANDBOX applies to every endpoint below — no
 * network call in this environment reached Printful's servers. Shapes are
 * built from Printful's documented v1 Orders API contract, not a live
 * round-trip. Pac's sandbox run (docs/fulfillment-dropship.md's test plan)
 * is the first real test.
 *
 * THE FLOW (draft → confirm): `createDraftOrder()` posts with
 * `confirm: false` — Printful holds the order as a DRAFT, which costs the
 * artist's Printful balance nothing. Only `confirmOrder()` submits it for
 * real fulfillment and spends against their account: an operator's click in
 * the admin desk, or (Admiral's ruling, block 973,932) the guarded
 * auto-confirm in dropship.ts (kill switch + daily USD cap + cost covered
 * by what the buyer paid; see auto-confirm.ts). A failed guard = a draft
 * waiting for the click.
 */

const PRINTFUL_API_BASE = "https://api.printful.com";

export interface PrintfulEnv {
  apiKey: string;
  /** only needed on a Printful account with multiple connected stores —
   *  the API demands X-PF-Store-Id when the token is account-level */
  storeId?: string;
}

export function printfulEnv(): PrintfulEnv | null {
  const apiKey = process.env.PRINTFUL_API_KEY;
  if (!apiKey) return null;
  return { apiKey, storeId: process.env.PRINTFUL_STORE_ID || undefined };
}

export function printfulConfigured(): boolean {
  return printfulEnv() !== null;
}

/** Hard ceiling on every Printful API call (the live-dependency hard stop:
 *  no outbound call on a page or checkout path without a time limit). */
export const PRINTFUL_TIMEOUT_MS = 8000;

async function printfulFetch(pathname: string, env: PrintfulEnv, init?: RequestInit): Promise<Response> {
  return fetch(`${PRINTFUL_API_BASE}${pathname}`, {
    signal: AbortSignal.timeout(PRINTFUL_TIMEOUT_MS),
    ...init,
    headers: {
      Authorization: `Bearer ${env.apiKey}`,
      "Content-Type": "application/json",
      ...(env.storeId ? { "X-PF-Store-Id": env.storeId } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
}

export type PrintfulCall<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; retryAfterSec?: number };

/**
 * One JSON call to Printful with the shared timeout. Never throws; the error
 * string carries the endpoint path and status, never a header or the key.
 * `signal` lets a caller pass a tighter shared deadline (shipping quote).
 */
export async function printfulRequest<T>(
  pathname: string,
  init?: RequestInit & { signal?: AbortSignal },
): Promise<PrintfulCall<T>> {
  const env = printfulEnv();
  if (!env) return { ok: false, error: "Printful not configured: set PRINTFUL_API_KEY" };
  const label = pathname.split("?")[0];
  try {
    const res = await printfulFetch(pathname, env, init);
    if (!res.ok) {
      const retry = Number(res.headers.get("retry-after"));
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        retryAfterSec: Number.isFinite(retry) && retry > 0 ? retry : undefined,
        error: `printful ${label} ${res.status} ${body.replace(/\s+/g, " ").slice(0, 160)}`.trim(),
      };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return { ok: false, error: timedOut ? `printful ${label} timed out` : `printful ${label} unreachable` };
  }
}

export interface PrintfulRecipient {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state_code?: string;
  country_code: string;
  zip?: string;
  phone?: string;
  email?: string;
}

/** The order's shipping → Printful's recipient shape. Null when the
 *  structured fields dropship.ts requires aren't all present — the caller
 *  refuses honestly rather than mailing a half-built address. */
export function recipientFromShipping(shipping: OrderRecord["shipping"], email?: string): PrintfulRecipient | null {
  if (!shipping?.name || !shipping.address1 || !shipping.city || !shipping.country) return null;
  return {
    name: shipping.name,
    address1: shipping.address1,
    address2: shipping.address2 || undefined,
    city: shipping.city,
    state_code: shipping.state || undefined,
    country_code: shipping.country,
    zip: shipping.zip || undefined,
    phone: shipping.phone || undefined,
    email: email || undefined,
  };
}

export interface PrintfulLineItem {
  sync_variant_id: string;
  quantity: number;
}

/** One order-line → its Printful sync_variant_id, keyed the same way
 *  StoreItem.partnerVariantIds is: by size label, or "" when sizeless.
 *  Null = the catalog item has no mapping for this line — dropship.ts's
 *  honest refusal point, not a guess. */
export function variantIdForLine(item: StoreItem, size: string | undefined): string | null {
  const map = item.partnerVariantIds;
  if (!map) return null;
  return map[size ?? ""] ?? map[""] ?? null;
}

/** Pure request-body builder — split out so the shape is unit-testable
 *  without a network call (scripts/dropship-lane-c.test.mjs), same
 *  discipline as payments.ts's buildSquarePaymentLinkBody. `confirm: false`
 *  is the whole draft-not-spend contract — never flip it here. */
export function buildPrintfulOrderBody(
  order: OrderRecord,
  recipient: PrintfulRecipient,
  items: PrintfulLineItem[],
) {
  return {
    external_id: order.id,
    recipient,
    items,
    confirm: false,
  };
}

export interface PrintfulOrderResult {
  ok: true;
  partnerOrderId: string;
  /** Printful's draft cost total in USD cents (result.costs.total), or null
   *  when the draft did not carry a readable USD total */
  costUsdMinor: number | null;
}

/** Pure: v1 `result.costs` -> USD cents. `total` is a dollar string ("12.34").
 *  Anything missing, non-numeric, zero, or in another currency = null. */
export function parseCostsUsdMinor(costs: { total?: string | number; currency?: string } | undefined): number | null {
  if (!costs) return null;
  if (costs.currency && costs.currency.toUpperCase() !== "USD") return null;
  const n = typeof costs.total === "number" ? costs.total : Number(String(costs.total ?? "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}
export interface PrintfulFailure {
  ok: false;
  error: string;
}

/** POST /orders — creates a DRAFT (confirm:false). ⚠ FIRST-VERIFIED-BY-
 *  PAC'S-SANDBOX. Never throws; every failure is a returned, loggable
 *  reason so the admin desk can show it instead of a stack trace. */
export async function createDraftOrder(
  order: OrderRecord,
  recipient: PrintfulRecipient,
  items: PrintfulLineItem[],
): Promise<PrintfulOrderResult | PrintfulFailure> {
  const env = printfulEnv();
  if (!env) return { ok: false, error: "Printful not configured — set PRINTFUL_API_KEY" };
  if (items.length === 0) return { ok: false, error: "no Printful-mapped lines on this order" };
  try {
    const res = await printfulFetch("/orders", env, {
      method: "POST",
      body: JSON.stringify(buildPrintfulOrderBody(order, recipient, items)),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `printful: draft create ${res.status} ${body.slice(0, 200)}` };
    }
    const json = (await res.json()) as {
      result?: { id?: number | string; costs?: { total?: string | number; currency?: string } };
    };
    const id = json.result?.id;
    if (id == null) return { ok: false, error: "printful: draft create returned no order id" };
    return { ok: true, partnerOrderId: String(id), costUsdMinor: parseCostsUsdMinor(json.result?.costs) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "printful: unreachable" };
  }
}

/** POST /orders/{id}/confirm — the ONE call that spends the artist's
 *  balance. Invoked from an operator's admin-desk click
 *  (src/app/api/admin/store/dropship/route.ts) or, since block 973,932, from
 *  the guarded auto-confirm in dropship.ts (kill switch + daily cap). ⚠ FIRST-VERIFIED-BY-PAC'S-SANDBOX. */
export async function confirmOrder(partnerOrderId: string): Promise<{ ok: true } | PrintfulFailure> {
  const env = printfulEnv();
  if (!env) return { ok: false, error: "Printful not configured — set PRINTFUL_API_KEY" };
  try {
    const res = await printfulFetch(`/orders/${encodeURIComponent(partnerOrderId)}/confirm`, env, { method: "POST" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `printful: confirm ${res.status} ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "printful: unreachable" };
  }
}

export type PrintfulOrderStatus = "draft" | "pending" | "fulfilled" | "shipped" | "canceled" | "failed" | "unknown";

/** Printful's order `status` field → our small canonical set. Pure and
 *  unit-tested — mirrors payments.ts's mapOrderState/mapInvoiceStatus
 *  pattern. ⚠ the exact status strings are FIRST-VERIFIED-BY-PAC'S-
 *  SANDBOX; anything unrecognized maps to "unknown" rather than a guess. */
export function mapPrintfulStatus(status: string | undefined): PrintfulOrderStatus {
  switch (status) {
    case "draft":
      return "draft";
    case "pending":
    case "inprocess":
    case "onhold":
      return "pending";
    case "fulfilled":
      return "fulfilled";
    case "shipped":
    case "partial":
      return "shipped";
    case "canceled":
      return "canceled";
    case "failed":
      return "failed";
    default:
      return "unknown";
  }
}

export interface PrintfulOrderSnapshot {
  status: PrintfulOrderStatus;
  trackingNumber?: string;
  trackingUrl?: string;
}

/** GET /orders/{id} cost only — the second look when the draft response had
 *  no readable total (Printful can still be calculating it). null = unknown. */
export async function fetchOrderCostUsdMinor(partnerOrderId: string): Promise<number | null> {
  const env = printfulEnv();
  if (!env) return null;
  try {
    const res = await printfulFetch(`/orders/${encodeURIComponent(partnerOrderId)}`, env);
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: { costs?: { total?: string | number; currency?: string } } };
    return parseCostsUsdMinor(json.result?.costs);
  } catch {
    return null;
  }
}

/** GET /orders/{id} — a status re-check the admin desk's "refresh" button
 *  calls, and the honest backstop when the webhook (below) never arrives.
 *  ⚠ FIRST-VERIFIED-BY-PAC'S-SANDBOX. */
export async function fetchOrderStatus(partnerOrderId: string): Promise<PrintfulOrderSnapshot | PrintfulFailure> {
  const env = printfulEnv();
  if (!env) return { ok: false, error: "Printful not configured — set PRINTFUL_API_KEY" };
  try {
    const res = await printfulFetch(`/orders/${encodeURIComponent(partnerOrderId)}`, env);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `printful: order read ${res.status} ${body.slice(0, 200)}` };
    }
    const json = (await res.json()) as {
      result?: { status?: string; shipments?: { tracking_number?: string; tracking_url?: string }[] };
    };
    const shipment = json.result?.shipments?.[0];
    return {
      status: mapPrintfulStatus(json.result?.status),
      trackingNumber: shipment?.tracking_number,
      trackingUrl: shipment?.tracking_url,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "printful: unreachable" };
  }
}

/**
 * Webhook verification (⚠ FIRST-VERIFIED-BY-PAC'S-SANDBOX, said plainly):
 * Printful's classic v1 webhook delivery has no widely-documented HMAC
 * signature scheme the way BTCPay/Square do — this build could not confirm
 * one from Printful's public docs without a live account to register a
 * webhook against. Rather than invent a signing scheme and present it as
 * fact, the honest safeguard here is a SHARED SECRET embedded in the
 * webhook URL itself (Printful's dashboard accepts any URL you register):
 * `/api/store/webhook/printful?key=<PRINTFUL_WEBHOOK_SECRET>`. No secret
 * configured = the route refuses every POST — same "no secret = nothing
 * verifies = nothing flips" contract payments.ts's webhooks hold. If
 * Pac's sandbox turns up a real signature header, upgrade this the same
 * way btcpayAdapter.verifyWebhook() works and keep the URL-secret as a
 * defense-in-depth backstop, not a replacement.
 */
export function verifyPrintfulWebhookKey(providedKey: string | null): boolean {
  const secret = process.env.PRINTFUL_WEBHOOK_SECRET;
  if (!secret || !providedKey) return false;
  const a = Buffer.from(providedKey);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface PrintfulWebhookEvent {
  partnerOrderId: string;
  status: PrintfulOrderStatus;
  trackingNumber?: string;
  trackingUrl?: string;
}

/** Printful's documented webhook event families: `package_shipped`,
 *  `order_failed`, `order_canceled`, `order_put_hold`, `order_remove_hold`
 *  — ⚠ FIRST-VERIFIED-BY-PAC'S-SANDBOX for the exact payload shape below.
 *  Returns null for an event type this build doesn't act on (never a
 *  guessed state flip). */
export function parsePrintfulWebhookBody(raw: unknown): PrintfulWebhookEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as {
    type?: string;
    data?: { order?: { id?: number | string; shipment?: { tracking_number?: string; tracking_url?: string } } };
  };
  const order = body.data?.order;
  if (order?.id == null) return null;
  const partnerOrderId = String(order.id);
  switch (body.type) {
    case "package_shipped":
      return {
        partnerOrderId,
        status: "shipped",
        trackingNumber: order.shipment?.tracking_number,
        trackingUrl: order.shipment?.tracking_url,
      };
    case "order_failed":
      return { partnerOrderId, status: "failed" };
    case "order_canceled":
      return { partnerOrderId, status: "canceled" };
    default:
      return null;
  }
}

export interface SyncVariantFile {
  /** Printful v1 file type: "default" (front), "back", "embroidery_chest_left", ... */
  type: string;
  /** the design file as the artist uploaded it */
  url: string;
}

export interface SyncVariantInfo {
  syncVariantId: string;
  /** the CATALOG variant (size/colour of the blank) and product it prints on */
  catalogVariantId: number;
  catalogProductId: number;
  files: SyncVariantFile[];
}

/** GET /store/variants/{sync_variant_id} (v1) -> the catalog ids and the design
 *  files behind one sync variant. The one door from the shelf's
 *  `partnerVariantIds` to everything else Printful knows about the product.
 *  ⚠ field names read from the v1 docs, not yet exercised live from here. */
type SyncVariantBody = {
  id?: number;
  variant_id?: number;
  product?: { product_id?: number; variant_id?: number };
  files?: { type?: string; url?: string }[];
};

export async function fetchSyncVariant(
  syncVariantId: string,
  signal?: AbortSignal,
): Promise<{ ok: true; info: SyncVariantInfo } | PrintfulFailure> {
  const call = await printfulRequest<{
    result?: SyncVariantBody & { sync_variant?: SyncVariantBody };
  }>(`/store/variants/${encodeURIComponent(syncVariantId)}`, signal ? { signal } : undefined);
  if (!call.ok) return { ok: false, error: call.error };
  // live v1 answers with the sync variant AS the result; keep the wrapped
  // shape too in case Printful ever nests it
  const sv = call.data.result?.sync_variant ?? call.data.result;
  const catalogVariantId = sv?.variant_id ?? sv?.product?.variant_id;
  let catalogProductId = sv?.product?.product_id;
  if (catalogVariantId && !catalogProductId) {
    // the catalog variant names its product (v1 GET /products/variant/{id})
    const cat = await printfulRequest<{ result?: { variant?: { product_id?: number } } }>(
      `/products/variant/${catalogVariantId}`,
      signal ? { signal } : undefined,
    );
    if (cat.ok) catalogProductId = cat.data.result?.variant?.product_id;
  }
  if (!catalogVariantId || !catalogProductId) {
    return { ok: false, error: `printful: sync variant ${syncVariantId} did not name its catalog product` };
  }
  const files = (sv?.files ?? [])
    .filter((f): f is { type: string; url: string } => Boolean(f.type && f.url) && f.type !== "preview")
    .map((f) => ({ type: f.type, url: f.url }));
  return { ok: true, info: { syncVariantId, catalogVariantId, catalogProductId, files } };
}

/** v1 file type -> v2 placement name ("default" is the front print). */
export function placementForFileType(type: string): string {
  return type === "default" ? "front" : type;
}
