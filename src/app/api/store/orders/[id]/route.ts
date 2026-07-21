import { NextResponse } from "next/server";
import { getOrder, getItem, recordChargeEvent } from "@/lib/store";
import { getAdapter } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Order status — the order id IS the capability (unguessable 96-bit random).
 * In-flight states reconcile against the processor directly (the receipt
 * page's live feed — rewritten records can be CDN-stale, the processor
 * can't be). Reconcile flips through recordChargeEvent — the same commit
 * function the webhook uses. Same guarantee, two triggers.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let order: Awaited<ReturnType<typeof getOrder>>;
  try {
    order = await getOrder(id);
  } catch (err) {
    return NextResponse.json(
      { ok: false, reason: `order vault unreachable: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 503 }
    );
  }
  if (!order) return NextResponse.json({ ok: false, reason: "no such order" }, { status: 404 });

  if (["charge_created", "processing"].includes(order.state) && order.chargeIds.length > 0) {
    const adapter = getAdapter(order.adapterId);
    if (adapter?.configured()) {
      try {
        const chargeId = order.chargeIds[order.chargeIds.length - 1];
        const state = await adapter.status(chargeId);
        if (state !== order.state && state !== "charge_created") {
          order = (await recordChargeEvent(order.id, { type: state, chargeId })) ?? order;
        }
      } catch {
        /* processor unreachable — serve the record of fact, honestly stale */
      }
    }
  }

  // downloadable? — a boolean + label for the receipt page, NEVER the path
  // (THE LEAK RULE in store.ts: blobPath stays server-side; the buyer's
  // only door to the file is /api/store/download/[orderId])
  let deliverable: { label: string } | undefined;
  for (const li of order.lineItems) {
    const item = await getItem(li.itemId);
    const d = item?.media?.deliverable;
    if (d?.blobPath) {
      deliverable = { label: d.label || li.title };
      break;
    }
  }

  // the buyer's view — never the full record (no events log, no purge bookkeeping)
  return NextResponse.json({
    ok: true,
    order: {
      id: order.id,
      state: order.state,
      lineItems: order.lineItems,
      priceSnapshot: order.priceSnapshot,
      entitlementSubject: order.entitlementSubject,
      createdAtMs: order.createdAtMs,
      settledAtMs: order.settledAtMs,
      deliverable,
    },
  });
}
