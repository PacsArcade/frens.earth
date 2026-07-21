import { NextResponse } from "next/server";
import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { listItems, upsertItem, removeItem, validateItem, type StoreItem } from "@/lib/store";
import { btcpayAdapter } from "@/lib/payments";
import { blobStoreEnabled } from "@/lib/registry";

export const dynamic = "force-dynamic";

/** The client screens are a courtesy; this check is the gate. */
function gate(request: Request): NextResponse | null {
  const operator = operatorFromCookieHeader(request.headers.get("cookie"));
  if (!operator) return NextResponse.json({ ok: false, reason: "operator session required" }, { status: 401 });
  return null;
}

export async function GET(request: Request) {
  const denied = gate(request);
  if (denied) return denied;
  return NextResponse.json({
    ok: true,
    items: await listItems({ includeHidden: true }),
    // honest rail states for the RAILS berths — btcpay is real (env-wired
    // or not); square/stripe are S5 SOON berths, no config to report yet
    rails: { btcpay: btcpayAdapter.configured() },
    // deliverable uploads: browser → blob directly when the blob store is
    // live; otherwise the dev driver (multipart to data/deliverables/)
    uploads: { deliverableDirect: blobStoreEnabled() },
  });
}

export async function PUT(request: Request) {
  const denied = gate(request);
  if (denied) return denied;
  let item: StoreItem;
  try {
    item = (await request.json()) as StoreItem;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad request" }, { status: 400 });
  }
  item.schemaVersion = 2;
  if (!item.id) item.id = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  item.fulfillment = item.fulfillment ?? item.kind;
  // v2 merchandising fields — trim to honest shapes; empty means absent
  item.sku = typeof item.sku === "string" && item.sku.trim() ? item.sku.trim() : undefined;
  item.sizes = Array.isArray(item.sizes)
    ? [...new Set(item.sizes.map((s) => String(s).trim()).filter(Boolean))]
    : undefined;
  if (item.sizes?.length === 0) item.sizes = undefined;
  if (item.media) {
    item.media = {
      images: Array.isArray(item.media.images) ? item.media.images.filter((u) => typeof u === "string" && u) : [],
      preview:
        typeof item.media.preview === "string" && item.media.preview.trim() ? item.media.preview.trim() : undefined,
      // blobPath rides along here — this route is operator-gated, the ONE
      // surface allowed to carry it (the leak rule in store.ts)
      deliverable:
        item.media.deliverable && item.media.deliverable.label?.trim()
          ? {
              kind: item.media.deliverable.kind,
              label: item.media.deliverable.label.trim(),
              blobPath:
                typeof item.media.deliverable.blobPath === "string" && item.media.deliverable.blobPath.trim()
                  ? item.media.deliverable.blobPath.trim()
                  : undefined,
            }
          : undefined,
    };
  }
  const valid = validateItem(item);
  if (!valid.ok) return NextResponse.json({ ok: false, reason: `needs ${valid.reason}` }, { status: 400 });
  return NextResponse.json({ ok: true, item: await upsertItem(item) });
}

export async function DELETE(request: Request) {
  const denied = gate(request);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, reason: "id required" }, { status: 400 });
  return NextResponse.json({ ok: await removeItem(id) });
}
