import { NextResponse } from "next/server";
import { getOrder, getItem, recordChargeEvent } from "@/lib/store";
import { sessionsFromRequest } from "@/lib/fren-auth";
import { getAdapter } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Order status — the order id IS the capability (unguessable 96-bit random).
 * In-flight states reconcile against the processor directly (the receipt
 * page's live feed — rewritten records can be CDN-stale, the processor
 * can't be). Reconcile flips through recordChargeEvent — the same commit
 * function the webhook uses. Same guarantee, two triggers.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  // downloadable? — a label + locked flag for the receipt page, NEVER the
  // path (THE LEAK RULE in store.ts: blobPath stays server-side; the
  // buyer's only door to the file is /api/store/download/[orderId]).
  // locked mirrors the download route's owner gate: a subject-bound order
  // opens only for the buying tag's own session — a shared receipt link
  // shows the receipt, never a live download affordance.
  let deliverable: { label: string; locked: boolean } | undefined;
  for (const li of order.lineItems) {
    const item = await getItem(li.itemId);
    const d = item?.media?.deliverable;
    if (d?.blobPath) {
      const locked = order.entitlementSubject
        ? !sessionsFromRequest(request).some((s) => `${s.handle}@${s.space}` === order.entitlementSubject)
        : false;
      deliverable = { label: d.label || li.title, locked };
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
