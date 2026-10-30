import { NextResponse } from "next/server";
import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { getItem, listItems, upsertItem, type StoreItem } from "@/lib/store";
import { blobStoreEnabled } from "@/lib/registry";
import { printfulConfigured, variantIdForLine } from "@/lib/printful";
import { blobPutDefault, mockupStep } from "@/lib/printful-mockups";
import { shelfPriceForSyncVariant, PRICE_CURRENCY } from "@/lib/printful-pricing";
import { usdMinorToSats } from "@/lib/btc-rate";

export const dynamic = "force-dynamic";
/** one item per call; the console loops, so each call stays well inside this */
export const maxDuration = 60;

const PRINTFUL_PICTURES = "/store/media/printful/";

function denied(request: Request): NextResponse | null {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return NextResponse.json({ ok: false, reason: "operator session required" }, { status: 401 });
  }
  return null;
}

/** The variant the pictures and the price are read from: the base size. */
function baseVariantId(item: StoreItem): string | null {
  return variantIdForLine(item, item.sizes?.[0]);
}

function hasPrintfulPictures(item: StoreItem): boolean {
  return (item.media?.images ?? item.images ?? []).some((u) => u.includes(PRINTFUL_PICTURES));
}

/** The console's list: every Printful item and what it still needs. */
export async function GET(request: Request) {
  const no = denied(request);
  if (no) return no;
  const items = (await listItems({ includeHidden: true })).filter((i) => i.partner === "printful");
  return NextResponse.json({
    ok: true,
    configured: printfulConfigured(),
    blob: blobStoreEnabled(),
    items: items.map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      mapped: baseVariantId(i) != null,
      hasPictures: hasPrintfulPictures(i),
    })),
  });
}

/**
 * POST { action: "pictures", itemId, taskId?, force? }
 *   one step of the one-item mockup job (see lib/printful-mockups.ts)
 * POST { action: "reprice", itemId, blurb? }
 *   price = Printful cost x 1.21 rounded up to the cent, plus sats; the copy
 *   is left alone unless the operator passes a new blurb
 */
export async function POST(request: Request) {
  const no = denied(request);
  if (no) return no;
  let body: { action?: string; itemId?: string; taskId?: string; force?: boolean; blurb?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad request" }, { status: 400 });
  }
  if (!printfulConfigured()) {
    return NextResponse.json({ ok: false, reason: "Printful is not configured on this deployment" }, { status: 503 });
  }
  const item = body.itemId ? await getItem(body.itemId) : null;
  if (!item || item.partner !== "printful") {
    return NextResponse.json({ ok: false, reason: "not a Printful item" }, { status: 404 });
  }
  const syncId = baseVariantId(item);
  if (!syncId) {
    return NextResponse.json({ ok: false, reason: "this item has no Printful variant id yet" }, { status: 400 });
  }

  if (body.action === "pictures") {
    if (!body.force && !body.taskId && hasPrintfulPictures(item)) {
      return NextResponse.json({ ok: true, state: "skipped", note: "already has Printful pictures" });
    }
    if (!blobStoreEnabled()) {
      return NextResponse.json({ ok: false, reason: "the blob store is not enabled here, pictures have nowhere to be kept" }, { status: 503 });
    }
    const step = await mockupStep(
      { itemId: item.id, syncVariantId: syncId, taskId: typeof body.taskId === "string" ? body.taskId : undefined },
      { putBlob: blobPutDefault },
    );
    if (step.state === "done") {
      const media = { ...(item.media ?? { images: [] }), images: step.images };
      await upsertItem({ ...item, media, images: step.images });
    }
    return NextResponse.json({ ok: step.state !== "error", ...step, reason: step.state === "error" ? step.error : undefined });
  }

  if (body.action === "reprice") {
    const price = await shelfPriceForSyncVariant(syncId);
    if (!price.ok) return NextResponse.json({ ok: false, reason: price.error }, { status: 502 });
    const sats = await usdMinorToSats(price.priceCents);
    const next: StoreItem = {
      ...item,
      price: { fiat: { amount: price.priceCents, currency: PRICE_CURRENCY }, ...(sats != null ? { sats } : {}) },
    };
    if (typeof body.blurb === "string" && body.blurb.trim()) next.blurb = body.blurb.trim();
    await upsertItem(next);
    return NextResponse.json({
      ok: true,
      costCents: price.costCents,
      priceCents: price.priceCents,
      // what the cost is made of (Printful's own prices), so a number can be checked
      parts: price.parts,
      sats: sats ?? null,
      note: sats == null ? "no bitcoin rate answered, sats left unset (the invoice converts from dollars)" : undefined,
    });
  }

  return NextResponse.json({ ok: false, reason: "unknown action" }, { status: 400 });
}
