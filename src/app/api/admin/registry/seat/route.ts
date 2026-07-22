import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { seatReservedHandle } from "@/lib/registry";
import { spaceForHost } from "@/lib/identity-config";
import { effectiveMempoolNode, MEMPOOL_URL_DEFAULT } from "@/lib/nodeconfig";

/**
 * Seat a reserved name — operator-only. The public claim route refuses
 * RESERVED names by design; this door exists so the house can seat its own
 * (the FLEET MAP panel posts here). Same key-is-the-operator gate as every
 * /api/admin route; every failure says why, with an honest status.
 */

/* Bitcoin time for the entry, same as the public claim — best-effort with a
   short leash: a slow or down explorer must never block the seat. Reads the
   admiral's configured mempool node first (sovereignty), public fallback. */
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
  return url !== MEMPOOL_URL_DEFAULT ? tipFrom(MEMPOOL_URL_DEFAULT) : null;
}

export async function POST(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }

  let body: { handle?: string; npub?: string; space?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }

  if (typeof body.handle !== "string" || typeof body.npub !== "string") {
    return Response.json({ ok: false, reason: "handle and npub required" }, { status: 400 });
  }

  // The console says which space it administers; host is the fallback.
  const space =
    typeof body.space === "string" ? body.space : spaceForHost(request.headers.get("host")).space;
  const result = await seatReservedHandle({
    handle: body.handle,
    npub: body.npub,
    space,
    blockHeight: await currentTipHeight(),
  });

  if (!result.ok) {
    const status =
      result.reason === "already claimed" ? 409 : result.reason.includes("hiccuped") ? 503 : 400;
    return Response.json(result, { status });
  }
  return Response.json(result);
}
