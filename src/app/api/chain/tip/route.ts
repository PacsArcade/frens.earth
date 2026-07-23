import { effectiveMempoolNode, MEMPOOL_URL_DEFAULT } from "@/lib/nodeconfig";

export const dynamic = "force-dynamic";

/**
 * The fleet's one door to chain data — the block tip and the live mempool fill,
 * read from the configured mempool node (the admiral's own instance) instead of
 * every client phoning mempool.space directly. Sovereignty fix (the admiral,
 * 2026-07-11): point mempoolUrl at Pac's Arcade's own node and the whole fleet
 * follows through this route.
 *
 * OWNER RULING (0018.04.22, binding): OUR NODE first, mempool.space next, and
 * the tip source stays PLUGGABLE — this route + effectiveMempoolNode() IS the
 * seam. Clients (the badge, the living clock) consume ONLY this door; flipping
 * the CHAIN knob to the house node rewires every clock with zero client code.
 *
 * Public + read-only — no auth, it's just chain data. Two hops: the configured
 * node first; if it's dark, fall back to the public mempool.space server-side so
 * a down node never takes the clock with it. Total failure returns { ok:false }
 * and the client keeps its genesis-anchored estimate — the honest ~. Never
 * throws; short leash so a slow node doesn't hang the page.
 *
 * `?full=1` — the living clock's richer reading (same node, same seam): adds
 * the tip block's chain TIMESTAMP (the honest block age — drives Pac's laps and
 * the struggling digit) and the difficulty adjustment (the arcade LEVEL arrow).
 * Both optional niceties: nulls never sink a good height.
 */

const TIMEOUT_MS = 5000;

interface Tip {
  height: number | null;
  mempoolVsize: number | null;
  mempoolCount: number | null;
  /** unix seconds the tip block was mined (chain fact) — `?full=1` only */
  tipTimestamp: number | null;
  /** estimated difficulty change %, next retarget — `?full=1` only */
  difficultyChange: number | null;
  /** blocks until the next retarget — `?full=1` only */
  difficultyRemaining: number | null;
}

/** One node's tip + fill (+ the full=1 extras). Returns nulls on anything less
    than a clean read; never throws. Everything past the height is a nicety —
    a missing endpoint doesn't sink a good height. */
async function readNode(base: string, full: boolean): Promise<Tip> {
  const url = base.replace(/\/+$/, "");
  const out: Tip = {
    height: null,
    mempoolVsize: null,
    mempoolCount: null,
    tipTimestamp: null,
    difficultyChange: null,
    difficultyRemaining: null,
  };

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

  if (out.height == null) return out;

  try {
    const res = await fetch(`${url}/api/mempool`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) {
      const m = await res.json();
      if (m && typeof m.vsize === "number") out.mempoolVsize = m.vsize;
      if (m && typeof m.count === "number") out.mempoolCount = m.count;
    }
  } catch {
    /* fill is optional — hold null, the ring just keeps its last reading */
  }

  if (full) {
    /* the tip block's chain timestamp — the study's fetchTipTime, moved
       behind the seam (the recent-blocks route carries the tip's stamp) */
    try {
      const res = await fetch(`${url}/api/blocks`, {
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) {
        const blocks = (await res.json()) as Array<{ height?: number; timestamp?: number }>;
        if (Array.isArray(blocks)) {
          const b = blocks.find((x) => x?.height === out.height) ?? blocks[0];
          if (b && typeof b.timestamp === "number" && Number.isFinite(b.timestamp))
            out.tipTimestamp = b.timestamp;
        }
      }
    } catch {
      /* optional — the client falls back to its observed break time */
    }

    try {
      const res = await fetch(`${url}/api/v1/difficulty-adjustment`, {
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) {
        const d = await res.json();
        if (d && Number.isFinite(d.difficultyChange)) out.difficultyChange = d.difficultyChange;
        if (d && Number.isFinite(d.remainingBlocks)) out.difficultyRemaining = d.remainingBlocks;
      }
    } catch {
      /* optional — the LEVEL badge simply drops its arrow */
    }
  }

  return out;
}

export async function GET(request: Request) {
  const full = new URL(request.url).searchParams.get("full") === "1";
  const { url, source } = await effectiveMempoolNode();

  // the configured node first — the admiral's own instance when pointed
  let tip = await readNode(url, full);
  let usedSource = source;

  // node dark and it wasn't already the public default? fall back server-side
  // so a down self-hosted node never takes the fleet's clock offline
  if (tip.height == null && url !== MEMPOOL_URL_DEFAULT) {
    tip = await readNode(MEMPOOL_URL_DEFAULT, full);
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
      mempoolCount: tip.mempoolCount,
      ...(full
        ? {
            tipTimestamp: tip.tipTimestamp,
            difficultyChange: tip.difficultyChange,
            difficultyRemaining: tip.difficultyRemaining,
          }
        : {}),
      source: usedSource,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
