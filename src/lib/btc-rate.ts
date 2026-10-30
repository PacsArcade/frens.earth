import { effectiveMempoolNode, MEMPOOL_URL_DEFAULT } from "./nodeconfig";

/**
 * Fiat -> sats, for pricing the shelf in sats and for the shipping add-on on
 * a sats-priced item. The repo had no converter (BTCPay converts a fiat
 * invoice itself), so this is the one place: the owner's configured chain
 * node FIRST, the public mempool.space second, each with a 5 s limit. It
 * returns null when no source answers; callers refuse or skip honestly, they
 * never invent a rate.
 */

export type RateFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Pure: USD-per-BTC + a minor-unit amount -> whole sats, rounded UP. */
export function fiatMinorToSats(minor: number, usdPerBtc: number): number {
  return Math.ceil((minor / 100 / usdPerBtc) * 1e8);
}

export async function usdPerBtc(f: RateFetch = fetch): Promise<number | null> {
  let bases = [MEMPOOL_URL_DEFAULT];
  try {
    const { url } = await effectiveMempoolNode();
    if (url && url !== MEMPOOL_URL_DEFAULT) bases = [url, MEMPOOL_URL_DEFAULT];
  } catch {
    /* node config unavailable: the public default still answers */
  }
  for (const base of bases) {
    try {
      const res = await f(`${base.replace(/\/+$/, "")}/api/v1/prices`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const usd = Number(((await res.json()) as { USD?: unknown }).USD);
      if (Number.isFinite(usd) && usd > 0) return usd;
    } catch {
      /* this source is dark: try the next */
    }
  }
  return null;
}

/** USD minor units -> sats, or null when no rate is available. */
export async function usdMinorToSats(minor: number, f: RateFetch = fetch): Promise<number | null> {
  const rate = await usdPerBtc(f);
  return rate == null ? null : fiatMinorToSats(minor, rate);
}
