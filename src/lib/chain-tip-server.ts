import { effectiveMempoolNode, MEMPOOL_URL_DEFAULT } from "./nodeconfig";
import { estimateHeight, type BlockInfo } from "./bb/bft";

/**
 * The SERVER-side block tip — sovereign truth for every record-writer.
 *
 * `currentBlockInfo()` (bb/bft.ts) reads the fleet's own door via the RELATIVE
 * `/api/chain/tip` fetch — which can't resolve server-side, so on the server it
 * always fell through to the public mempool.space. This is the server path that
 * honors sovereignty: the admiral's configured node FIRST
 * (effectiveMempoolNode(): stored → env → public), the public mempool.space
 * only if that's dark, and a genesis-anchored ~10-min/block estimate only when
 * both are unreachable — flagged `estimated: true` so no writer ever etches a
 * guess as a block fact. Same ladder merges.ts's signingStamp always walked;
 * this is its single source of truth now.
 */
export async function serverBlockInfo(): Promise<BlockInfo> {
  try {
    const { url } = await effectiveMempoolNode();
    const bases =
      url && url !== MEMPOOL_URL_DEFAULT ? [url, MEMPOOL_URL_DEFAULT] : [MEMPOOL_URL_DEFAULT];
    for (const base of bases) {
      try {
        const res = await fetch(`${base.replace(/\/+$/, "")}/api/blocks/tip/height`, {
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const h = parseInt((await res.text()).trim(), 10);
          if (Number.isFinite(h) && h > 0) return { height: h, estimated: false };
        }
      } catch {
        /* this base is dark — try the next */
      }
    }
  } catch {
    /* node config unavailable — fall through to the honest estimate */
  }
  return { height: estimateHeight(), estimated: true };
}
