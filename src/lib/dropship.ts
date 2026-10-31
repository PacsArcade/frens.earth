import { getItem, getOrder, setDropship, markFulfilled, type OrderRecord, type StoreItem, type DropshipRecord } from "./store";
import { printfulConfigured, recipientFromShipping, variantIdForLine, createDraftOrder, type PrintfulLineItem } from "./printful";
import { fourthwallConfigured } from "./fourthwall";
import {
  autoConfirmSettings,
  decideAutoConfirm,
  paidUsdMinor,
  autoConfirmUsedToday,
  reserveAutoConfirm,
  releaseAutoConfirm,
} from "./auto-confirm";

/**
 * The bridge between money and DROP-SHIP FULFILLMENT (S6 ruling 6, ported
 * from vanilla-template's Lane C — docs/fulfillment-dropship.md there is
 * the runbook this rail follows). Both settle-fanout points call this —
 * the BTCPay webhook route and the receipt page's reconcile poll
 * (`api/store/orders/[id]`) — so the effect is re-derivable from order
 * state rather than dependent on catching one event.
 *
 * Idempotent by construction: a dropship record already past `draft_pending`
 * is left alone — this never re-creates a draft that already exists.
 *
 * SPEND RULE (changed at block 973,932 by the Admiral's ruling "auto confirm
 * daily cap"; before it nothing here ever submitted): right after a draft is
 * created the shop MAY confirm it itself, only when the guards in
 * auto-confirm.ts all pass (PRINTFUL_AUTO_CONFIRM on, a daily USD cap set,
 * Printful's cost known and covered by what the buyer paid, today's UTC
 * total within the cap). Any failed guard leaves the draft for the
 * operator's click in the admin desk, with the reason recorded on
 * `dropship.autoConfirm`. The auto path runs only from the single draft
 * creation, so a webhook retry (state already past draft) cannot confirm twice.
 */

/** The catalog item behind a partner-fulfilled line, plus its size — v1
 *  handles ONE partner per order (a mixed-partner basket is a real but
 *  narrow edge; the first partner-carrying line wins and this is said
 *  plainly in the docs, not hidden). */
async function partnerLine(order: OrderRecord): Promise<{ item: StoreItem; size?: string } | null> {
  for (const li of order.lineItems) {
    const item = await getItem(li.itemId);
    if (item?.partner) return { item, size: li.size };
  }
  return null;
}

/** Every physical-partner line on the order, item + size + qty — the shape
 *  a real multi-item drop-ship order needs. */
async function partnerLines(order: OrderRecord): Promise<{ item: StoreItem; size?: string; qty: number }[]> {
  const out: { item: StoreItem; size?: string; qty: number }[] = [];
  for (const li of order.lineItems) {
    const item = await getItem(li.itemId);
    if (item?.partner) out.push({ item, size: li.size, qty: li.qty || 1 });
  }
  return out;
}

/** Structured shipping fields Printful's recipient needs — pure, unit
 *  tested. Distinct from the plain "has a name and an address string"
 *  check checkout already runs; this is the STRICTER gate a partner order
 *  additionally needs. */
export function hasStructuredAddress(shipping: OrderRecord["shipping"]): boolean {
  return Boolean(shipping?.name && shipping.address1 && shipping.city && shipping.country);
}

export interface DropshipResult {
  ran: boolean;
  state?: DropshipRecord["state"];
  note?: string;
}

const NOTHING: DropshipResult = { ran: false };

/**
 * Both the BTCPay webhook and the receipt page's reconcile poll call this —
 * same fan-out point every settle trigger rides. Reads the order's CURRENT
 * state and makes the drop-ship record match it:
 *   settled/fulfilled + a partner line + no draft yet → try to draft it
 *     (Printful: a real API call, free to the artist; Fourthwall: the
 *     honest manual_bridge state, no call made — see fourthwall.ts)
 *   refunded/disputed + a draft already SUBMITTED → flag cancel_needed
 *     (Printful's cancel-after-submit API wasn't confirmed either — this
 *     is a loud "go cancel it by hand" note, never a silent no-op)
 *   anything else → no-op, returned honestly as such
 */
export async function settleDropshipFromOrder(order: OrderRecord): Promise<DropshipResult> {
  const first = await partnerLine(order);
  if (!first) return { ...NOTHING, note: "no partner-fulfilled line on this order" };

  if (order.state === "settled" || order.state === "fulfilled") {
    if (order.dropship && order.dropship.state !== "draft_pending" && order.dropship.state !== "draft_failed") {
      return { ran: false, state: order.dropship.state, note: "already past draft — no-op" };
    }
    return draftDropship(order, first.item);
  }

  if (order.state === "refunded" || order.state === "disputed") {
    if (order.dropship?.state === "submitted" || order.dropship?.state === "shipped") {
      await setDropship(order.id, { partner: order.dropship.partner, state: "cancel_needed" });
      return { ran: true, state: "cancel_needed", note: `order ${order.state} after submit — cancel it by hand at the partner` };
    }
    return { ...NOTHING, note: `order ${order.state}; no submitted drop-ship order to cancel` };
  }

  return { ...NOTHING, note: `order is ${order.state}` };
}

async function draftDropship(order: OrderRecord, item: StoreItem): Promise<DropshipResult> {
  if (item.partner === "fourthwall") {
    if (!fourthwallConfigured()) {
      await setDropship(order.id, { partner: "fourthwall", state: "draft_pending", lastError: "Fourthwall not configured" });
      return { ran: true, state: "draft_pending", note: "Fourthwall not configured" };
    }
    // v1 honest limit (fourthwall.ts's header): no verified order-
    // submission API — the admin desk's manual bridge is the whole story.
    await setDropship(order.id, { partner: "fourthwall", state: "manual_bridge" });
    return { ran: true, state: "manual_bridge" };
  }

  // printful
  if (!printfulConfigured()) {
    await setDropship(order.id, { partner: "printful", state: "draft_pending", lastError: "Printful not configured — set PRINTFUL_API_KEY" });
    return { ran: true, state: "draft_pending", note: "Printful not configured" };
  }

  const recipient = recipientFromShipping(order.shipping, order.contact?.email);
  if (!recipient) {
    await setDropship(order.id, {
      partner: "printful",
      state: "draft_failed",
      lastError: "shipping address is incomplete — needs name, address1, city, country",
    });
    return { ran: true, state: "draft_failed", note: "incomplete address" };
  }

  const lines = await partnerLines(order);
  const items: PrintfulLineItem[] = [];
  const missing: string[] = [];
  for (const l of lines) {
    const variantId = variantIdForLine(l.item, l.size);
    if (!variantId) {
      missing.push(l.item.title);
      continue;
    }
    items.push({ sync_variant_id: variantId, quantity: l.qty });
  }
  if (items.length === 0) {
    const reason = `no Printful variant mapping on: ${missing.join(", ") || item.title}`;
    await setDropship(order.id, { partner: "printful", state: "draft_failed", lastError: reason });
    return { ran: true, state: "draft_failed", note: reason };
  }

  const result = await createDraftOrder(order, recipient, items);
  if (!result.ok) {
    await setDropship(order.id, { partner: "printful", state: "draft_failed", lastError: result.error });
    return { ran: true, state: "draft_failed", note: result.error };
  }
  await setDropship(order.id, { partner: "printful", state: "draft_created", partnerOrderId: result.partnerOrderId, lastError: undefined });
  return autoConfirmDraft(order.id, result.partnerOrderId, result.costUsdMinor);
}

/** Block 973,932 ruling: try to confirm the draft just created, guarded
 *  (see auto-confirm.ts). Never throws; a failure of any guard or of the
 *  store leaves the draft for the operator's click. Re-reads the order so a
 *  concurrent run that already decided or confirmed is respected. */
async function autoConfirmDraft(orderId: string, partnerOrderId: string, draftCost: number | null): Promise<DropshipResult> {
  const drafted: DropshipResult = { ran: true, state: "draft_created" };
  const settings = autoConfirmSettings();
  if (!settings.enabled) return drafted; // off = today's behaviour, nothing recorded
  try {
    const fresh = await getOrder(orderId);
    if (!fresh?.dropship) return drafted;
    let cost = draftCost;
    if (cost == null) {
      const { fetchOrderCostUsdMinor } = await import("./printful");
      cost = await fetchOrderCostUsdMinor(partnerOrderId);
    }
    let live: number | null = null;
    if (fresh.priceSnapshot.currency === "SATS" && !(fresh.priceSnapshot.rate && fresh.priceSnapshot.rate > 0)) {
      const { usdPerBtc } = await import("./btc-rate");
      live = await usdPerBtc();
    }
    const paid = paidUsdMinor(fresh.priceSnapshot, live);
    const used = await autoConfirmUsedToday();
    const d = decideAutoConfirm({
      settings,
      costUsdMinor: cost,
      paidUsdMinor: paid.minor,
      paidFromSats: paid.fromSats,
      usedTodayUsdMinor: used,
      dropshipState: fresh.dropship.state,
      alreadyDecided: Boolean(fresh.dropship.autoConfirm),
    });
    if (d.decision === "held") {
      await setDropship(orderId, { partner: "printful", state: "draft_created", autoConfirm: { at: Date.now(), costUsdMinor: cost, decision: "held", reason: d.reason } });
      return { ...drafted, note: `auto-confirm held: ${d.reason}` };
    }
    const cap = await reserveAutoConfirm(cost as number, settings.capUsdMinor);
    if (!cap.ok) {
      await setDropship(orderId, { partner: "printful", state: "draft_created", autoConfirm: { at: Date.now(), costUsdMinor: cost, decision: "held", reason: `daily cap reached (used $${(cap.used / 100).toFixed(2)})` } });
      return { ...drafted, note: "auto-confirm held: daily cap reached" };
    }
    const result = await confirmDropship(fresh);
    if (result.state !== "submitted") {
      await releaseAutoConfirm(cost as number);
      await setDropship(orderId, { partner: "printful", state: "submit_failed", autoConfirm: { at: Date.now(), costUsdMinor: cost, decision: "held", reason: `confirm call failed: ${result.note ?? "unknown"}` } });
      return { ran: true, state: "submit_failed", note: result.note };
    }
    await setDropship(orderId, { partner: "printful", state: "submitted", autoConfirm: { at: Date.now(), costUsdMinor: cost, decision: "confirmed", reason: d.reason } });
    return { ran: true, state: "submitted", note: "auto-confirmed" };
  } catch (err) {
    // the store or the rate source misbehaved: the draft stays, the click remains
    return { ...drafted, note: `auto-confirm skipped: ${err instanceof Error ? err.message : "error"}` };
  }
}

/** The confirm door — the ONE place that spends the artist's Printful
 *  balance. Callers: the operator's click (src/app/api/admin/store/
 *  dropship/route.ts) and, since block 973,932, autoConfirmDraft above, which
 *  runs only after every auto-confirm guard has passed. */
export async function confirmDropship(order: OrderRecord): Promise<DropshipResult> {
  const ds = order.dropship;
  if (!ds || ds.partner !== "printful") return { ...NOTHING, note: "no Printful draft to confirm" };
  if (ds.state !== "draft_created" && ds.state !== "submit_failed") {
    return { ran: false, state: ds.state, note: `drop-ship is "${ds.state}" — nothing to confirm` };
  }
  if (!ds.partnerOrderId) return { ...NOTHING, note: "no partner order id recorded" };
  const { confirmOrder } = await import("./printful");
  const result = await confirmOrder(ds.partnerOrderId);
  if (!result.ok) {
    await setDropship(order.id, { partner: "printful", state: "submit_failed", lastError: result.error });
    return { ran: true, state: "submit_failed", note: result.error };
  }
  await setDropship(order.id, { partner: "printful", state: "submitted", lastError: undefined });
  return { ran: true, state: "submitted" };
}

/** The admin desk's "refresh status" button AND the webhook receiver both
 *  land here — re-derivable from the partner's own report, same
 *  idempotency contract as recordChargeEvent(). Flips the ORDER's state to
 *  "fulfilled" through the one sanctioned markFulfilled() the moment a
 *  shipment is reported, so the artist never reconciles two separate
 *  fulfillment stories. */
export async function applyDropshipStatus(
  order: OrderRecord,
  snapshot: { status: "shipped" | "canceled" | "failed" | "draft" | "pending" | "fulfilled" | "unknown"; trackingNumber?: string; trackingUrl?: string },
): Promise<DropshipResult> {
  const ds = order.dropship;
  if (!ds || ds.partner !== "printful") return { ...NOTHING, note: "no Printful drop-ship on this order" };
  if (snapshot.status === "shipped") {
    await setDropship(order.id, {
      partner: "printful",
      state: "shipped",
      trackingNumber: snapshot.trackingNumber,
      trackingUrl: snapshot.trackingUrl,
      lastError: undefined,
    });
    await markFulfilled(order.id);
    return { ran: true, state: "shipped" };
  }
  if (snapshot.status === "failed") {
    await setDropship(order.id, { partner: "printful", state: "submit_failed", lastError: "partner reports the order failed" });
    return { ran: true, state: "submit_failed" };
  }
  if (snapshot.status === "canceled") {
    await setDropship(order.id, { partner: "printful", state: "cancel_needed", lastError: "partner reports the order was canceled" });
    return { ran: true, state: "cancel_needed" };
  }
  return { ran: false, state: ds.state, note: `no change — partner reports "${snapshot.status}"` };
}
