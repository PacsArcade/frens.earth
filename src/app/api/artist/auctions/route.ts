import { artistFromRequest, auctionBoard } from "@/lib/artist";

export const dynamic = "force-dynamic";

/**
 * The auction board — open/rolling space-name auctions straight from this
 * deployment's spaced node. Artist-gated. Degrades honestly: configured:false
 * when no node is linked, reachable:false when it's down — the board never
 * pretends there's an auction it can't see.
 */
export async function GET(request: Request) {
  const gate = await artistFromRequest(request);
  if (!gate.ok) {
    return Response.json({ ok: false, reason: gate.reason }, { status: gate.status });
  }
  const board = await auctionBoard();
  return Response.json({ ok: true, ...board });
}
