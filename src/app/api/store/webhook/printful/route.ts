import { NextResponse } from "next/server";
import { verifyPrintfulWebhookKey, parsePrintfulWebhookBody } from "@/lib/printful";
import { applyDropshipStatus } from "@/lib/dropship";
import { listOrders } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * The Printful webhook (S6 ruling 6, ported from vanilla-template's Lane
 * C). Verification is a SHARED SECRET in the URL's query string (`?key=`),
 * not an HMAC header — see printful.ts's verifyPrintfulWebhookKey() doc for
 * why: no HMAC scheme for Printful's classic webhooks could be confirmed
 * without a live account, and inventing one would be worse than not having
 * it. No `PRINTFUL_WEBHOOK_SECRET` configured, or a wrong/missing `key` =
 * the route refuses every POST — same "no secret = nothing verifies =
 * nothing flips" contract payments.ts's BTCPay HMAC holds, just a
 * different lock. The v2 signed-webhook upgrade is a separate, queued task
 * — not attempted here.
 *
 * This is a BACKSTOP, not the only path to a "shipped" state — the admin
 * desk's "refresh status" button polls the same fact directly
 * (fetchOrderStatus), so a webhook that never arrives (misconfigured,
 * Printful account not wired to point here yet) still resolves honestly
 * the next time an operator checks.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!verifyPrintfulWebhookKey(url.searchParams.get("key"))) {
    // no oracle for a forger poking around — same 200-shaped nothing the
    // BTCPay webhook returns on a bad signature
    return NextResponse.json({ ok: true });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }
  const event = parsePrintfulWebhookBody(body);
  if (!event) return NextResponse.json({ ok: true });

  // Printful's payload carries THEIR order id, not ours — this codebase's
  // order id lives in `order.dropship.partnerOrderId`, set at draft-create
  // time (dropship.ts). A short scan of settled orders finds the match;
  // orders are few enough per-artist that this is honest and simple rather
  // than a second index to keep in sync.
  const orders = await listOrders();
  const order = orders.find((o) => o.dropship?.partnerOrderId === event.partnerOrderId);
  if (order) {
    await applyDropshipStatus(order, { status: event.status, trackingNumber: event.trackingNumber, trackingUrl: event.trackingUrl }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
