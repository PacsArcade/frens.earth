import { NextResponse } from "next/server";
import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { listItems, listOrders, type OrderState } from "@/lib/store";
import { bftDateTime, estimateHeight } from "@/lib/bb/bft";

export const dynamic = "force-dynamic";

/**
 * The inventory report (spec: Module 6 / S1.5) — one small, flat JSON an
 * artist can pull on a phone: shelf counts, the order book by state, sats
 * actually settled, and the ids that need hands. Operator-gated exactly
 * like the rest of /api/admin/store; the mobile screen is a courtesy,
 * this check is the gate.
 */

/** Every state appears, zero included — a flat, predictable mobile shape. */
const ORDER_STATES: OrderState[] = [
  "created",
  "charge_created",
  "processing",
  "settled",
  "fulfilled",
  "expired",
  "underpaid",
  "canceled",
  "refunded",
  "disputed",
];

/** Money that actually landed: settled + fulfilled (refunds gave it back). */
const SETTLED_STATES: OrderState[] = ["settled", "fulfilled"];

export async function GET(request: Request) {
  const operator = operatorFromCookieHeader(request.headers.get("cookie"));
  if (!operator) {
    return NextResponse.json({ ok: false, reason: "operator session required" }, { status: 401 });
  }

  const [items, orders] = await Promise.all([listItems({ includeHidden: true }), listOrders()]);

  const byState = Object.fromEntries(ORDER_STATES.map((s) => [s, 0])) as Record<OrderState, number>;
  let settledSats = 0;
  for (const o of orders) {
    byState[o.state] += 1;
    if (SETTLED_STATES.includes(o.state) && o.priceSnapshot.currency === "SATS") {
      settledSats += o.priceSnapshot.amount;
    }
  }

  return NextResponse.json({
    ok: true,
    wares: {
      total: items.length,
      live: items.filter((i) => i.status === "live").length,
      hidden: items.filter((i) => i.status === "hidden").length,
      soldout: items.filter((i) => i.status === "soldout").length,
    },
    orders: {
      byState,
      settledSats,
      needsAttention: orders.filter((o) => o.state === "settled").map((o) => o.id),
    },
    /* estimateHeight is a genesis-anchored guess, so the stamp wears the
       honest ~ (bft-display law) */
    generatedAt: `~${bftDateTime(estimateHeight())}`,
  });
}
