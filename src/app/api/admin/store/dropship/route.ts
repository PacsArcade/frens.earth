import { NextResponse } from "next/server";
import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { listOrders, getOrder, getItem, markFulfilled, type OrderRecord } from "@/lib/store";
import { settleDropshipFromOrder, confirmDropship, applyDropshipStatus } from "@/lib/dropship";
import { fetchOrderStatus, printfulConfigured } from "@/lib/printful";
import { fourthwallConfigured, fourthwallBridgeNote } from "@/lib/fourthwall";

export const dynamic = "force-dynamic";

/** The artist's own operator gate — the client screen is a courtesy. */
function gate(request: Request): NextResponse | null {
  const operator = operatorFromCookieHeader(request.headers.get("cookie"));
  if (!operator) return NextResponse.json({ ok: false, reason: "operator session required" }, { status: 401 });
  return null;
}

export interface DropshipView {
  order: OrderRecord;
  partner: "printful" | "fourthwall";
  /** the partner-line item's own title — what the operator recognizes */
  itemTitle: string;
  /** Fourthwall's manual-bridge note, present only for that partner */
  bridgeNote?: string;
  productUrl?: string;
}

/** The partner-fulfilled line's item, if this order carries one. */
async function partnerLineItem(order: OrderRecord) {
  for (const li of order.lineItems) {
    const item = await getItem(li.itemId);
    if (item?.partner) return item;
  }
  return null;
}

/**
 * The pending-fulfillment desk (S6 ruling 6). GET lists every order
 * carrying a partner-fulfilled line, newest first. POST is the one door
 * that spends the artist's Printful balance (`action: "confirm"`) — always
 * an explicit operator click, never automatic.
 */
export async function GET(request: Request) {
  const denied = gate(request);
  if (denied) return denied;
  const all = await listOrders();
  const views: DropshipView[] = [];
  for (const o of all) {
    const item = await partnerLineItem(o);
    if (!item?.partner) continue;
    views.push({
      order: o,
      partner: item.partner,
      itemTitle: item.title,
      bridgeNote: item.partner === "fourthwall" ? fourthwallBridgeNote(Boolean(item.partnerProductUrl)) : undefined,
      productUrl: item.partnerProductUrl,
    });
  }
  return NextResponse.json({
    ok: true,
    views,
    printfulConfigured: printfulConfigured(),
    fourthwallConfigured: fourthwallConfigured(),
  });
}

export async function POST(request: Request) {
  const denied = gate(request);
  if (denied) return denied;
  let body: { orderId?: string; action?: "create-draft" | "confirm" | "refresh" | "mark-fulfilled" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad request" }, { status: 400 });
  }
  if (!body.orderId || !body.action) {
    return NextResponse.json({ ok: false, reason: "orderId and action required" }, { status: 400 });
  }
  const order = await getOrder(body.orderId);
  if (!order) return NextResponse.json({ ok: false, reason: "no such order" }, { status: 404 });

  if (body.action === "mark-fulfilled") {
    // the Fourthwall manual-bridge close: the operator re-created the order
    // there by hand and it shipped — the SAME sanctioned flip the plain
    // self-fulfilled ("artist ships by hand") order book already uses
    const fulfilled = await markFulfilled(order.id);
    return NextResponse.json({ ok: true, order: fulfilled });
  }

  if (body.action === "create-draft") {
    // the retry door — settleDropshipFromOrder is idempotent (it no-ops
    // once a draft already exists), so this is safe to press again after a
    // fix (e.g. the artist just set PRINTFUL_API_KEY or fixed the mapping)
    const result = await settleDropshipFromOrder(order);
    const fresh = await getOrder(order.id);
    return NextResponse.json({ ok: true, result, order: fresh });
  }

  if (body.action === "confirm") {
    // THE spend gate — an operator's explicit click, nothing else calls this
    const result = await confirmDropship(order);
    const fresh = await getOrder(order.id);
    return NextResponse.json({ ok: true, result, order: fresh });
  }

  if (body.action === "refresh") {
    if (!order.dropship?.partnerOrderId) {
      return NextResponse.json({ ok: false, reason: "no partner order id on this order yet" }, { status: 400 });
    }
    const snapshot = await fetchOrderStatus(order.dropship.partnerOrderId);
    if (!("status" in snapshot)) {
      return NextResponse.json({ ok: false, reason: snapshot.error }, { status: 502 });
    }
    const result = await applyDropshipStatus(order, snapshot);
    const fresh = await getOrder(order.id);
    return NextResponse.json({ ok: true, result, order: fresh });
  }

  return NextResponse.json({ ok: false, reason: "unknown action" }, { status: 400 });
}
