import { artistFromRequest, listNameRequests, requestName } from "@/lib/artist";
import { serverBlockInfo } from "@/lib/chain-tip-server";

export const dynamic = "force-dynamic";

/**
 * Name requests — request → auction → won/lost → anchored. Artist-gated both
 * ways: GET lists only the caller's own requests (scoped by npub), POST files
 * a new one stamped with the bitcoin tip. The request is a queue entry — the
 * on-chain open/bid happens on the node's wallet, never here.
 */
export async function GET(request: Request) {
  const gate = await artistFromRequest(request);
  if (!gate.ok) {
    return Response.json({ ok: false, reason: gate.reason }, { status: gate.status });
  }
  return Response.json({ ok: true, requests: await listNameRequests({ npub: gate.npub }) });
}

export async function POST(request: Request) {
  const gate = await artistFromRequest(request);
  if (!gate.ok) {
    return Response.json({ ok: false, reason: gate.reason }, { status: gate.status });
  }
  let body: { name?: string; note?: string };
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
    /* the stamp is a nicety — never block a request on the tip lookup */
  }
  const result = await requestName({
    name: body.name ?? "",
    note: body.note,
    npub: gate.npub,
    requestedBy: `${gate.handle}@${gate.space}`,
    blockHeight,
  });
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
