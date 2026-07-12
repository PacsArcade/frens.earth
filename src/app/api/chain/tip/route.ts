import { effectiveMempoolNode, MEMPOOL_URL_DEFAULT } from "@/lib/nodeconfig";

export const dynamic = "force-dynamic";

/**
 * The fleet's one door to chain data — the block tip and the live mempool fill,
 * read from the configured mempool node (the admiral's own instance) instead of
 * every client phoning mempool.space directly. Sovereignty fix (the admiral,
 * 2026-07-11): point mempoolUrl at Pac's Arcade's own node and the whole fleet
 * follows through this route.
 *
 * Public + read-only — no auth, it's just chain data. Two hops: the configured
 * node first; if it's dark, fall back to the public mempool.space server-side so
 * a down node never takes the clock with it. Total failure returns { ok:false }
 * and the client keeps its genesis-anchored estimate — the honest ~. Never
 * throws; short leash so a slow node doesn't hang the page.
 */

const TIMEOUT_MS = 5000;

interface Tip {
  height: number | null;
  mempoolVsize: number | null;
}

/** One node's tip + fill. Returns nulls on anything less than a clean read;
    never throws. mempool fill is a nicety — a missing /api/mempool doesn't
    sink a good height. */
async function readNode(base: string): Promise<Tip> {
  const url = base.replace(/\/+$/, "");
  const out: Tip = { height: null, mempoolVsize: null };

  try {
    const res = await fetch(`${url}/api/blocks/tip/height`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) {
      const h = parseInt((await res.text()).trim(), 10);
      if (Number.isFinite(h) && h > 0) out.height = h;
    }
  } catch {
    /* dark node → out.height stays null, caller decides on fallback */
  }

  if (out.height != null) {
    try {
      const res = await fetch(`${url}/api/mempool`, {
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) {
        const m = await res.json();
        if (m && typeof m.vsize === "number") out.mempoolVsize = m.vsize;
      }
    } catch {
      /* fill is optional — hold null, the ring just keeps its last reading */
    }
  }

  return out;
}

export async function GET() {
  const { url, source } = await effectiveMempoolNode();

  // the configured node first — the admiral's own instance when pointed
  let tip = await readNode(url);
  let usedSource = source;

  // node dark and it wasn't already the public default? fall back server-side
  // so a down self-hosted node never takes the fleet's clock offline
  if (tip.height == null && url !== MEMPOOL_URL_DEFAULT) {
    tip = await readNode(MEMPOOL_URL_DEFAULT);
    if (tip.height != null) usedSource = "default";
  }

  if (tip.height == null) {
    // total failure — the client keeps its genesis estimate (the honest ~)
    return Response.json({ ok: false }, { headers: { "Cache-Control": "no-store" } });
  }

  return Response.json(
    {
      ok: true,
      height: tip.height,
      mempoolVsize: tip.mempoolVsize,
      source: usedSource,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
