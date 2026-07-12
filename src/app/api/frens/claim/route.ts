import { claimHandle } from "@/lib/registry";
import { spaceForHost } from "@/lib/identity-config";
import { effectiveMempoolNode, MEMPOOL_URL_DEFAULT } from "@/lib/nodeconfig";

/* Bitcoin time for the entry — "player since block N". Best-effort with a
   short leash: a slow or down explorer must never block a claim. Server-side,
   so it reads the admiral's configured mempool node directly (sovereignty fix,
   2026-07-11) rather than a hardcoded third party — the public mempool.space is
   only the fallback when the configured node is dark. */
async function tipFrom(base: string): Promise<number | null> {
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/api/blocks/tip/height`, {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const h = parseInt((await res.text()).trim(), 10);
    return Number.isFinite(h) && h > 0 ? h : null;
  } catch {
    return null;
  }
}

async function currentTipHeight(): Promise<number | null> {
  const { url } = await effectiveMempoolNode();
  const h = await tipFrom(url);
  if (h != null) return h;
  // configured node dark → fall back to the public default, then give up (the
  // requestedAt date is the ultimate fallback — never block a claim on this)
  return url !== MEMPOOL_URL_DEFAULT ? tipFrom(MEMPOOL_URL_DEFAULT) : null;
}

export async function POST(request: Request) {
  let body: { handle?: string; npub?: string; space?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }

  if (typeof body.handle !== "string" || typeof body.npub !== "string") {
    return Response.json({ ok: false, reason: "handle and npub required" }, { status: 400 });
  }

  // The registration page says which space it issues from; host is the fallback
  const space =
    typeof body.space === "string" ? body.space : spaceForHost(request.headers.get("host")).space;
  const result = await claimHandle(body.handle, body.npub, space, await currentTipHeight());
  if (!result.ok) {
    return Response.json(result, { status: 409 });
  }
  return Response.json(result);
}
