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

export const dynamic = "force-dynamic";

/**
 * Single-item checkout (no cart — v1 scope, said out loud). Two shapes:
 * - { itemId, contact?, shipping? }  → new order + first charge
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
    orderId?: string;
    size?: string;
    contact?: { email?: string };
    shipping?: { name?: string; address?: string };
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
  const snapshot: PriceSnapshot =
    effective.sats != null
      ? { amount: effective.sats, currency: "SATS", at: new Date().toISOString() }
      : { amount: effective.fiat!.amount, currency: effective.fiat!.currency, at: new Date().toISOString() };

  const order: OrderRecord = {
    id: newOrderId(),
    schemaVersion: 2,
    state: "created",
    lineItems: [{ itemId: item.id, title: item.title, qty: 1, size: item.sizes?.length ? size : undefined }],
    priceSnapshot: snapshot,
    adapterId: adapter.id,
    chargeIds: [],
    entitlementSubject,
    contact: body.contact,
    shipping: item.fulfillment === "self" ? body.shipping : undefined,
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
