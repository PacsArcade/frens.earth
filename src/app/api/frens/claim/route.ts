import { claimHandle } from "@/lib/registry";
import { spaceForHost } from "@/lib/identity-config";

/* Bitcoin time for the entry — "player since block N". Best-effort with a
   short leash: a slow or down explorer must never block a claim. */
async function currentTipHeight(): Promise<number | null> {
  try {
    const res = await fetch("https://mempool.space/api/blocks/tip/height", {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    const h = await res.json();
    return typeof h === "number" ? h : null;
  } catch {
    return null;
  }
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
