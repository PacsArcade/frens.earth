import { NextResponse } from "next/server";
import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { listItems, upsertItem, removeItem, validateItem, type StoreItem } from "@/lib/store";

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
  return NextResponse.json({ ok: true, items: await listItems({ includeHidden: true }) });
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
  item.schemaVersion = 1;
  if (!item.id) item.id = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  item.fulfillment = item.fulfillment ?? item.kind;
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
