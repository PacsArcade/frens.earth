import { artistFromRequest, listWatches, addWatch, removeWatch } from "@/lib/artist";
import { serverBlockInfo } from "@/lib/chain-tip-server";

export const dynamic = "force-dynamic";

/**
 * WATCH YOUR NAME — an artist's watchlist, persisted per-npub (dual-driver
 * store, same as tickets). Artist-gated; every verb operates only on the
 * caller's own watches.
 */
export async function GET(request: Request) {
  const gate = await artistFromRequest(request);
  if (!gate.ok) {
    return Response.json({ ok: false, reason: gate.reason }, { status: gate.status });
  }
  return Response.json({ ok: true, watches: await listWatches(gate.npub) });
}

export async function POST(request: Request) {
  const gate = await artistFromRequest(request);
  if (!gate.ok) {
    return Response.json({ ok: false, reason: gate.reason }, { status: gate.status });
  }
  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }
  let blockHeight: number | null = null;
  try {
    /* own node first (serverBlockInfo); an estimate never gets etched as a
       block fact — null renders the honest ~ from the wall timestamp */
    const tip = await serverBlockInfo();
    if (!tip.estimated) blockHeight = tip.height;
  } catch {
    /* stamp is a nicety */
  }
  const result = await addWatch({ npub: gate.npub, name: body.name ?? "", blockHeight });
  return Response.json(result, { status: result.ok ? 200 : 400 });
}

export async function DELETE(request: Request) {
  const gate = await artistFromRequest(request);
  if (!gate.ok) {
    return Response.json({ ok: false, reason: gate.reason }, { status: gate.status });
  }
  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }
  const removed = await removeWatch(gate.npub, body.name ?? "");
  if (!removed) {
    return Response.json({ ok: false, reason: "that name isn't on your watchlist" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
