import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { effectiveMempoolNode } from "@/lib/nodeconfig";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 6000;

/**
 * Admin — does the configured chain node answer at its tip? Backbone of the
 * /a/mempool panel: point → save → test. One honest fetch of
 * {url}/api/blocks/tip/height: REACHABLE means it returned a real height;
 * anything else reports exactly what came back. `source: "default"` is the tell
 * that the fleet is still phoning the public mempool.space — point your own
 * below. Operator-gated; never throws on a dark node.
 */
export async function GET(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  const { url, source } = await effectiveMempoolNode();

  let reachable = false;
  let height: number | null = null;
  let httpStatus: number | null = null;
  let reason: string | undefined;
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/api/blocks/tip/height`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    httpStatus = res.status;
    if (res.ok) {
      const h = parseInt((await res.text()).trim(), 10);
      if (Number.isFinite(h) && h > 0) {
        reachable = true;
        height = h;
      } else {
        reason = "node answered but the tip didn't parse as a height";
      }
    } else {
      reason = `node answered HTTP ${res.status}`;
    }
  } catch (err) {
    reason = `node unreachable: ${err instanceof Error ? err.message : String(err)}`;
  }

  return Response.json({ ok: true, url, source, reachable, height, httpStatus, reason });
}
