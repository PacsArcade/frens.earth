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
 * THE FLOW (draft → confirm, never auto-spend): `createDraftOrder()` posts
 * with `confirm: false` — Printful holds the order as a DRAFT, which costs
 * the artist's Printful balance nothing. Only `confirmOrder()` (an
 * operator's explicit click in the admin desk, never called from a webhook
 * or a settle path) submits it for real fulfillment and spends against
 * their account — the same "no auto-spend of Pac's balance without the
 * admin's click" grain the fleet holds elsewhere.
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

async function printfulFetch(pathname: string, env: PrintfulEnv, init?: RequestInit): Promise<Response> {
  return fetch(`${PRINTFUL_API_BASE}${pathname}`, {
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
    const json = (await res.json()) as { result?: { id?: number | string } };
    const id = json.result?.id;
    if (id == null) return { ok: false, error: "printful: draft create returned no order id" };
    return { ok: true, partnerOrderId: String(id) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "printful: unreachable" };
  }
}

/** POST /orders/{id}/confirm — the ONE call that spends the artist's
 *  balance. Only ever invoked from an operator's explicit admin-desk click
 *  (src/app/api/admin/store/dropship/route.ts), never from a webhook, a
 *  settle helper, or a cron tick. ⚠ FIRST-VERIFIED-BY-PAC'S-SANDBOX. */
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
