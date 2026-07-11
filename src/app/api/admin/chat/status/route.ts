import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { effectiveChatNode } from "@/lib/nodeconfig";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 6000;

/**
 * Admin — does the chat floor (orbee) answer at the configured door?
 * Backbone of the /a/chat panel: point → save → test. One honest fetch:
 * REACHABLE means the URL answered 2xx; anything else reports exactly what
 * came back (or didn't). Never throws on a dark floor — the door link on the
 * panel still works either way.
 */
export async function GET(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  const { url, source } = await effectiveChatNode();

  let reachable = false;
  let httpStatus: number | null = null;
  let reason: string | undefined;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    httpStatus = res.status;
    reachable = res.ok;
    if (!res.ok) reason = `floor answered HTTP ${res.status}`;
  } catch (err) {
    reason = `floor unreachable: ${err instanceof Error ? err.message : String(err)}`;
  }

  return Response.json({ ok: true, url, source, reachable, httpStatus, reason });
}
