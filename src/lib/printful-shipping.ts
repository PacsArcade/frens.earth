import {
  fetchSyncVariant,
  printfulRequest,
  variantIdForLine,
  PRINTFUL_TIMEOUT_MS,
  type PrintfulRecipient,
} from "./printful";
import { usdMinorToSats } from "./btc-rate";
import type { Price, StoreItem } from "./store";

/**
 * Shipping for Printful lines (Admiral's ruling, block 973,766): the buyer
 * pays Printful's own rate, shown BEFORE payment and added to the charge.
 *
 * THE ONE FUNCTION TO SWAP: `quoteShipping()` is the only thing checkout
 * calls. A flat fee later means replacing its body with
 * `{ ok: true, amountMinor: FLAT, currency: "USD", method: "Flat rate" }`
 * and nothing else changes.
 *
 * Never charges without a rate: any failure (not configured, no variant
 * mapping, timeout, Printful refusing the address) comes back as
 * { ok: false, reason } and checkout refuses with that message. The whole
 * quote shares ONE 8 s deadline, so a slow Printful costs the buyer at most
 * 8 s before the honest refusal.
 */

export interface ShippingQuote {
  ok: true;
  /** USD minor units (cents) */
  amountMinor: number;
  currency: string;
  /** Printful's name for the cheapest service, e.g. "Flat Rate (3-4 business days)" */
  method: string;
  minDays?: number;
  maxDays?: number;
}
export interface ShippingRefusal {
  ok: false;
  reason: string;
}

interface RateRow {
  id?: string;
  name?: string;
  rate?: string | number;
  currency?: string;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
}

/** Pure: Printful's rate list -> the cheapest usable row as a quote. */
export function cheapestRate(rows: RateRow[] | undefined): ShippingQuote | null {
  let best: ShippingQuote | null = null;
  for (const r of rows ?? []) {
    const n = typeof r.rate === "number" ? r.rate : Number(String(r.rate ?? "").trim());
    if (!Number.isFinite(n) || n < 0) continue;
    const amountMinor = Math.round(n * 100);
    if (!best || amountMinor < best.amountMinor) {
      best = {
        ok: true,
        amountMinor,
        currency: (r.currency || "USD").toUpperCase(),
        method: r.name || r.id || "Printful shipping",
        minDays: r.minDeliveryDays,
        maxDays: r.maxDeliveryDays,
      };
    }
  }
  return best;
}

export interface QuoteLine {
  item: StoreItem;
  size?: string;
  qty: number;
}

/** Printful's rate for these lines to this recipient, or an honest refusal. */
export async function quoteShipping(
  recipient: PrintfulRecipient,
  lines: QuoteLine[],
): Promise<ShippingQuote | ShippingRefusal> {
  if (lines.length === 0) return { ok: false, reason: "no Printful lines to quote" };
  const signal = AbortSignal.timeout(PRINTFUL_TIMEOUT_MS);
  try {
    const items: { variant_id: number; quantity: number }[] = [];
    for (const line of lines) {
      const syncId = variantIdForLine(line.item, line.size);
      if (!syncId) {
        return { ok: false, reason: "this item is not linked to a Printful variant yet, so shipping cannot be quoted" };
      }
      const v = await fetchSyncVariant(syncId, signal);
      if (!v.ok) return { ok: false, reason: "shipping could not be quoted right now, please try again in a minute" };
      items.push({ variant_id: v.info.catalogVariantId, quantity: line.qty });
    }
    const call = await printfulRequest<{ result?: RateRow[] }>("/shipping/rates", {
      method: "POST",
      signal,
      body: JSON.stringify({
        recipient: {
          address1: recipient.address1,
          city: recipient.city,
          country_code: recipient.country_code,
          state_code: recipient.state_code,
          zip: recipient.zip,
        },
        items,
        currency: "USD",
      }),
    });
    if (!call.ok) {
      const refused = call.status === 400 || call.status === 422;
      return {
        ok: false,
        reason: refused
          ? "Printful could not quote shipping to that address, please check it"
          : "shipping could not be quoted right now, please try again in a minute",
      };
    }
    const quote = cheapestRate(call.data.result);
    if (!quote) return { ok: false, reason: "Printful offered no shipping option to that address" };
    return quote;
  } catch {
    return { ok: false, reason: "shipping could not be quoted right now, please try again in a minute" };
  }
}

export interface ShippedCharge {
  ok: true;
  /** what the invoice is for: item + shipping, in the item's own currency */
  amount: number;
  currency: string;
  /** the shipping part, in that same currency, for the receipt line */
  shippingAmount: number;
  /** the item part, same currency */
  itemAmount: number;
}

/** Pure-ish: the item's price + Printful's shipping -> the one charge. A sats
 *  priced item adds the shipping in sats (needs a bitcoin rate: none = refuse);
 *  a dollar priced item adds cents. Never mixes currencies. */
export async function chargeWithShipping(
  price: Price,
  quote: ShippingQuote,
  toSats: (usdMinor: number) => Promise<number | null> = (m) => usdMinorToSats(m),
): Promise<ShippedCharge | ShippingRefusal> {
  if (quote.currency !== "USD") {
    return { ok: false, reason: "shipping was quoted in a currency this shelf cannot take yet" };
  }
  if (price.sats != null) {
    const shipSats = await toSats(quote.amountMinor);
    if (shipSats == null) {
      return { ok: false, reason: "could not price shipping in bitcoin right now, please try again in a minute" };
    }
    return { ok: true, amount: price.sats + shipSats, currency: "SATS", shippingAmount: shipSats, itemAmount: price.sats };
  }
  if (!price.fiat || price.fiat.currency !== "USD") {
    return { ok: false, reason: "this item is not priced in a currency shipping can be added to" };
  }
  return {
    ok: true,
    amount: price.fiat.amount + quote.amountMinor,
    currency: "USD",
    shippingAmount: quote.amountMinor,
    itemAmount: price.fiat.amount,
  };
}
