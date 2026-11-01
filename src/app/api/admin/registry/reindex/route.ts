import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { rebuildIndex } from "@/lib/registry";
import { spaceForHost } from "@/lib/identity-config";

export const dynamic = "force-dynamic";

/**
 * Rebuild the NIP-05 / whois index from the per-handle records. Operator-only.
 * Use it when a seated name is missing from nostr.json or whois.
 */
export async function POST(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  let space = spaceForHost(request.headers.get("host")).space;
  try {
    const body = await request.json();
    if (typeof body?.space === "string") space = body.space;
  } catch {
    // no body is fine
  }
  const result = await rebuildIndex(space);
  if (!result) {
    return Response.json({ ok: false, reason: "no index on this storage driver" }, { status: 409 });
  }
  return Response.json({ ok: true, space, count: result.count });
}
