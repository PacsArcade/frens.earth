import { createHmac, timingSafeEqual } from "crypto";
import type { ChargeEventType } from "./store";

/**
 * The payments adapter — ONE interface, many rails (spec module 2).
 * v1 wires BTCPay (bitcoin on-chain + lightning, the artist's own node).
 * Square and Stripe slot behind the same shapes later: hosted-redirect
 * payUrl always, discriminated webhook events, idempotency key on create.
 * The app holds API tokens to the artist's own processors — never funds.
 */

export type CanonicalChargeState = "charge_created" | "processing" | "settled" | "expired" | "invalid";

export interface ChargeRequest {
  orderId: string;
  amount: number; // integer: sats when currency SATS, minor units otherwise
  currency: string; // "SATS" or ISO-4217
  buyerEmail?: string;
  redirectUrl: string;
}

export interface CreatedCharge {
  chargeId: string;
  /** hosted redirect — ALWAYS (the Stripe-Checkout/Square-Link compatible shape) */
  payUrl: string;
  extras?: { bolt11?: string; onchainAddress?: string };
}

export interface ChargeEvent {
  type: ChargeEventType;
  chargeId: string;
}

export interface PaymentAdapter {
  id: "btcpay" | "square" | "stripe";
  rails: ("onchain" | "lightning" | "card")[];
  configured(): boolean;
  createCharge(req: ChargeRequest, idempotencyKey: string): Promise<CreatedCharge>;
  status(chargeId: string): Promise<CanonicalChargeState>;
  /** raw body in, verified discriminated event out — or null for noise */
  verifyWebhook(rawBody: string, headers: Headers): Promise<ChargeEvent | null>;
}

// ---------------------------------------------------------------------------
// BTCPay Server (Greenfield API) — the v1 rail
// ---------------------------------------------------------------------------

function btcpayEnv() {
  const url = process.env.BTCPAY_URL?.replace(/\/$/, "");
  const storeId = process.env.BTCPAY_STORE_ID;
  const apiKey = process.env.BTCPAY_API_KEY;
  return url && storeId && apiKey ? { url, storeId, apiKey } : null;
}

async function btcpayFetch(pathname: string, init?: RequestInit): Promise<Response> {
  const env = btcpayEnv();
  if (!env) throw new Error("btcpay: not configured");
  return fetch(`${env.url}/api/v1/stores/${env.storeId}${pathname}`, {
    ...init,
    headers: {
      Authorization: `token ${env.apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
}

/** BTCPay invoice lifecycle → the canonical machine (spec's mapping table). */
function mapInvoiceStatus(status: string): CanonicalChargeState {
  switch (status) {
    case "New":
      return "charge_created";
    case "Processing":
      return "processing";
    case "Settled":
      return "settled";
    case "Expired":
      return "expired";
    default:
      return "invalid";
  }
}

/** Webhook event types → the canonical union. Settles ONLY on InvoiceSettled. */
function mapWebhookType(type: string): ChargeEventType | null {
  switch (type) {
    case "InvoiceSettled":
      return "settled";
    case "InvoiceProcessing":
    case "InvoiceReceivedPayment":
      return "processing";
    case "InvoiceExpired":
      return "expired";
    case "InvoiceInvalid":
      return "invalid";
    default:
      return null;
  }
}

export const btcpayAdapter: PaymentAdapter = {
  id: "btcpay",
  rails: ["onchain", "lightning"],

  configured() {
    return btcpayEnv() !== null;
  },

  async createCharge(req, idempotencyKey) {
    // BTCPay has no idempotency header — the orderId in metadata is the
    // dedupe handle; a retried create mints a new invoice for the SAME order
    // (chargeIds[] absorbs it; only one can settle).
    const amount =
      req.currency === "SATS" ? (req.amount / 1e8).toFixed(8) : (req.amount / 100).toFixed(2);
    const currency = req.currency === "SATS" ? "BTC" : req.currency;
    const res = await btcpayFetch("/invoices", {
      method: "POST",
      body: JSON.stringify({
        amount,
        currency,
        metadata: { orderId: req.orderId, idempotencyKey, buyerEmail: req.buyerEmail },
        checkout: { redirectURL: req.redirectUrl },
      }),
    });
    if (!res.ok) throw new Error(`btcpay: invoice create ${res.status}`);
    const inv = (await res.json()) as { id: string; checkoutLink: string };
    return { chargeId: inv.id, payUrl: inv.checkoutLink };
  },

  async status(chargeId) {
    const res = await btcpayFetch(`/invoices/${chargeId}`);
    if (!res.ok) throw new Error(`btcpay: invoice read ${res.status}`);
    const inv = (await res.json()) as { status: string };
    return mapInvoiceStatus(inv.status);
  },

  async verifyWebhook(rawBody, headers) {
    // HMAC-SHA256 over the RAW body; secret is a SEPARATE credential from
    // the API key (template contract). No secret configured = nothing
    // verifies = nothing flips. A forged POST buys nothing.
    const secret = process.env.BTCPAY_WEBHOOK_SECRET;
    const sig = headers.get("btcpay-sig");
    if (!secret || !sig?.startsWith("sha256=")) return null;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const given = sig.slice("sha256=".length);
    if (
      given.length !== expected.length ||
      !timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"))
    ) {
      return null;
    }
    const payload = JSON.parse(rawBody) as { type: string; invoiceId?: string };
    const type = mapWebhookType(payload.type);
    if (!type || !payload.invoiceId) return null;
    return { type, chargeId: payload.invoiceId };
  },
};

export function getAdapter(id: string): PaymentAdapter | null {
  return id === "btcpay" ? btcpayAdapter : null;
}

/** The rail the shelf sells on today. Honest: null when nothing is wired. */
export function liveAdapter(): PaymentAdapter | null {
  return btcpayAdapter.configured() ? btcpayAdapter : null;
}
