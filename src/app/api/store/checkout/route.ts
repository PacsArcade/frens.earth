import { NextResponse } from "next/server";
import {
  getItem,
  getOrder,
  createOrder,
  attachCharge,
  newOrderId,
  ordersConfigured,
  type OrderRecord,
  type PriceSnapshot,
} from "@/lib/store";
import { liveAdapter } from "@/lib/payments";
import { frenFromRequest } from "@/lib/fren-auth";
import { hasStructuredAddress } from "@/lib/dropship";
import { recipientFromShipping } from "@/lib/printful";
import { chargeWithShipping, quoteShipping } from "@/lib/printful-shipping";
import { normalizeCartLines, resolveCart, cartSubtotal, orderLineItems } from "@/lib/cart";

export const dynamic = "force-dynamic";

/**
 * Checkout. Three shapes:
 * - { itemId, contact?, shipping? }  → new single-item order + first charge
 * - { lines: [{itemId,size?,qty}], contact?, shipping? } → a cart order (see
 *   src/lib/cart.ts for what a cart may hold; digital/package stay single-buy)
 * - { orderId }                      → fresh charge for an expired order
 * Digital/package items require a fren session — the entitlement subject is
 * captured HERE, because the paid webhook is server-to-server and the order
 * is the only identity source at grant time.
 */
export async function POST(request: Request) {
  const adapter = liveAdapter();
  if (!adapter) {
    return NextResponse.json(
      { ok: false, reason: "payment rail not connected — the shelf is browse-only" },
      { status: 503 }
    );
  }
  if (!ordersConfigured()) {
    return NextResponse.json({ ok: false, reason: "order store not configured" }, { status: 503 });
  }

  let body: {
    itemId?: string;
    lines?: unknown;
    orderId?: string;
    size?: string;
    contact?: { email?: string };
    shipping?: OrderRecord["shipping"];
    /** Printful items: ask for the shipping rate only, create nothing */
    quoteOnly?: boolean;
    /** Printful items: the shipping amount (minor units) the buyer was shown */
    acceptedShippingMinor?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad request" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  // re-charge an expired order: same order, fresh invoice
  if (body.orderId) {
    const order = await getOrder(body.orderId);
    if (!order) return NextResponse.json({ ok: false, reason: "no such order" }, { status: 404 });
    if (!["expired", "underpaid", "charge_created"].includes(order.state)) {
      return NextResponse.json({ ok: false, reason: `order is ${order.state}` }, { status: 409 });
    }
    const charge = await adapter.createCharge(
      {
        orderId: order.id,
        amount: order.priceSnapshot.amount,
        currency: order.priceSnapshot.currency,
        buyerEmail: order.contact?.email,
        redirectUrl: `${origin}/store/order/${order.id}`,
      },
      `${order.id}:${order.chargeIds.length}`
    );
    await attachCharge(order.id, charge.chargeId);
    return NextResponse.json({ ok: true, orderId: order.id, payUrl: charge.payUrl, extras: charge.extras });
  }

  if (body.lines !== undefined) return cartCheckout(body, adapter, origin);

  const item = body.itemId ? await getItem(body.itemId) : null;
  if (!item || item.status !== "live") {
    return NextResponse.json({ ok: false, reason: "not on the shelf" }, { status: 404 });
  }

  // sized wares require a chosen size — the artist can't ship "one of each"
  const size = typeof body.size === "string" ? body.size.trim() : "";
  if (item.sizes?.length && !item.sizes.includes(size)) {
    return NextResponse.json(
      { ok: false, reason: `pick a size: ${item.sizes.join(" / ")}` },
      { status: 400 }
    );
  }

  // a drop-ship PARTNER line needs Printful's structured address fields —
  // refuse honestly, before any charge, rather than draft a half-built
  // recipient later (S6 ruling 6; dropship.ts's own stricter gate)
  if (item.partner && !hasStructuredAddress(body.shipping)) {
    return NextResponse.json(
      { ok: false, reason: "this item ships via a fulfillment partner — a complete address (name, street, city, country) is required before checkout" },
      { status: 400 }
    );
  }

  // the gate's subject: packages + digital goods buy AS someone
  let entitlementSubject: string | undefined;
  if (item.kind === "digital" || item.kind === "package") {
    const fren = frenFromRequest(request);
    if (!fren) {
      return NextResponse.json(
        { ok: false, reason: "sign in with your tag to buy this — it unlocks FOR you" },
        { status: 401 }
      );
    }
    entitlementSubject = `${fren.handle}@${fren.space}`;
  }

  // sats-primary: sale price (gold rail) wins when present
  const effective = item.sale ?? item.price;
  let snapshot: PriceSnapshot =
    effective.sats != null
      ? { amount: effective.sats, currency: "SATS", at: new Date().toISOString() }
      : { amount: effective.fiat!.amount, currency: effective.fiat!.currency, at: new Date().toISOString() };

  // Printful lines: the buyer pays Printful's own shipping rate, shown BEFORE
  // payment. No rate = no charge: the quote refuses honestly (one function,
  // quoteShipping(), is what a flat fee would replace later).
  let shippingFee: OrderRecord["shippingFee"];
  if (item.partner === "printful") {
    const recipient = recipientFromShipping(body.shipping, body.contact?.email);
    if (!recipient) {
      return NextResponse.json({ ok: false, reason: "a complete address is required to quote shipping" }, { status: 400 });
    }
    const quote = await quoteShipping(recipient, [{ item, size: size || undefined, qty: 1 }]);
    if (!quote.ok) return NextResponse.json({ ok: false, reason: quote.reason }, { status: 503 });
    const charge = await chargeWithShipping(effective, quote);
    if (!charge.ok) return NextResponse.json({ ok: false, reason: charge.reason }, { status: 503 });
    const shown = {
      shipping: { amount: charge.shippingAmount, currency: charge.currency },
      shippingUsdMinor: quote.amountMinor,
      method: quote.method,
      minDays: quote.minDays,
      maxDays: quote.maxDays,
      item: { amount: charge.itemAmount, currency: charge.currency },
      total: { amount: charge.amount, currency: charge.currency },
    };
    if (body.quoteOnly) return NextResponse.json({ ok: true, quote: shown });
    if (body.acceptedShippingMinor !== quote.amountMinor) {
      // the buyer has not seen this exact rate yet (or it moved): show it, do not charge
      return NextResponse.json(
        { ok: false, reason: "confirm the shipping rate before paying", quote: shown },
        { status: 409 }
      );
    }
    snapshot = { amount: charge.amount, currency: charge.currency, at: new Date().toISOString() };
    shippingFee = { amount: charge.shippingAmount, currency: charge.currency, method: quote.method };
  }

  const order: OrderRecord = {
    id: newOrderId(),
    schemaVersion: 2,
    state: "created",
    lineItems: [{ itemId: item.id, title: item.title, qty: 1, size: item.sizes?.length ? size : undefined }],
    priceSnapshot: snapshot,
    shippingFee,
    adapterId: adapter.id,
    chargeIds: [],
    entitlementSubject,
    contact: body.contact,
    // a real gap the source port also fixed while in the neighborhood: gate
    // on fulfillment "self" OR a partner line, not fulfillment alone — a
    // partner item's kind/fulfillment already reads "self" in practice, but
    // this stays honest even if that assumption ever loosens
    shipping: item.fulfillment === "self" || item.partner ? body.shipping : undefined,
    createdAtMs: Date.now(),
    events: [],
  };
  await createOrder(order);

  const charge = await adapter.createCharge(
    {
      orderId: order.id,
      amount: snapshot.amount,
      currency: snapshot.currency,
      buyerEmail: body.contact?.email,
      redirectUrl: `${origin}/store/order/${order.id}`,
    },
    `${order.id}:0`
  );
  await attachCharge(order.id, charge.chargeId);

  return NextResponse.json({ ok: true, orderId: order.id, payUrl: charge.payUrl, extras: charge.extras });
}

interface CartBody {
  lines?: unknown;
  contact?: { email?: string };
  shipping?: OrderRecord["shipping"];
  quoteOnly?: boolean;
  acceptedShippingMinor?: number;
}

/** A cart order: every line re-priced from the catalog, one shipper, one
 *  shipping quote for all Printful lines, refusals before any order exists. */
async function cartCheckout(
  body: CartBody,
  adapter: NonNullable<ReturnType<typeof liveAdapter>>,
  origin: string,
) {
  const norm = normalizeCartLines(body.lines);
  if (!norm.ok) return NextResponse.json({ ok: false, reason: norm.reason }, { status: norm.status });
  const items = new Map<string, Awaited<ReturnType<typeof getItem>>>();
  for (const l of norm.lines) if (!items.has(l.itemId)) items.set(l.itemId, await getItem(l.itemId));
  const cart = resolveCart(norm.lines, items);
  if (!cart.ok) return NextResponse.json({ ok: false, reason: cart.reason }, { status: cart.status });

  const partnerLines = cart.lines.filter((l) => l.item.partner);
  if (partnerLines.length > 0 && !hasStructuredAddress(body.shipping)) {
    return NextResponse.json(
      { ok: false, reason: "this cart ships via a fulfillment partner, so a complete address (name, street, city, country) is required before checkout" },
      { status: 400 }
    );
  }
  if (partnerLines.length === 0 && !(body.shipping?.name && body.shipping?.address)) {
    return NextResponse.json({ ok: false, reason: "a name and address are required to ship this cart" }, { status: 400 });
  }

  const subtotal = cartSubtotal(cart.lines);
  let snapshot: PriceSnapshot =
    subtotal.sats != null
      ? { amount: subtotal.sats, currency: "SATS", at: new Date().toISOString() }
      : { amount: subtotal.fiat!.amount, currency: subtotal.fiat!.currency, at: new Date().toISOString() };

  let shippingFee: OrderRecord["shippingFee"];
  if (cart.shipper === "printful") {
    const recipient = recipientFromShipping(body.shipping, body.contact?.email);
    if (!recipient) {
      return NextResponse.json({ ok: false, reason: "a complete address is required to quote shipping" }, { status: 400 });
    }
    const quote = await quoteShipping(
      recipient,
      cart.lines.map((l) => ({ item: l.item, size: l.size, qty: l.qty })),
    );
    if (!quote.ok) return NextResponse.json({ ok: false, reason: quote.reason }, { status: 503 });
    const charge = await chargeWithShipping(subtotal, quote);
    if (!charge.ok) return NextResponse.json({ ok: false, reason: charge.reason }, { status: 503 });
    const shown = {
      shipping: { amount: charge.shippingAmount, currency: charge.currency },
      shippingUsdMinor: quote.amountMinor,
      method: quote.method,
      minDays: quote.minDays,
      maxDays: quote.maxDays,
      item: { amount: charge.itemAmount, currency: charge.currency },
      total: { amount: charge.amount, currency: charge.currency },
    };
    if (body.quoteOnly) return NextResponse.json({ ok: true, quote: shown });
    if (body.acceptedShippingMinor !== quote.amountMinor) {
      return NextResponse.json(
        { ok: false, reason: "confirm the shipping rate before paying", quote: shown },
        { status: 409 }
      );
    }
    snapshot = { amount: charge.amount, currency: charge.currency, at: new Date().toISOString() };
    shippingFee = { amount: charge.shippingAmount, currency: charge.currency, method: quote.method };
  } else if (body.quoteOnly) {
    return NextResponse.json({ ok: false, reason: "this cart has no shipping quote to show" }, { status: 400 });
  }

  const order: OrderRecord = {
    id: newOrderId(),
    schemaVersion: 2,
    state: "created",
    lineItems: orderLineItems(cart.lines),
    priceSnapshot: snapshot,
    shippingFee,
    adapterId: adapter.id,
    chargeIds: [],
    contact: body.contact,
    shipping: body.shipping,
    createdAtMs: Date.now(),
    events: [],
  };
  await createOrder(order);

  const charge = await adapter.createCharge(
    {
      orderId: order.id,
      amount: snapshot.amount,
      currency: snapshot.currency,
      buyerEmail: body.contact?.email,
      redirectUrl: `${origin}/store/order/${order.id}`,
    },
    `${order.id}:0`
  );
  await attachCharge(order.id, charge.chargeId);
  return NextResponse.json({ ok: true, orderId: order.id, payUrl: charge.payUrl, extras: charge.extras });
}
