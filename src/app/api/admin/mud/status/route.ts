import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { mudConfigured, mudHasToken, getMudConfig, getMudStats, MudNodeError } from "@/lib/mud";

export const dynamic = "force-dynamic";

/**
 * Admin — is this deployment's MUD node reachable, and does the admin token
 * work? Backbone of the "connect your MUD" panel: point → test → verified.
 * Operator-gated; never throws on a down node.
 */
export async function GET(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  if (!mudConfigured()) {
    return Response.json({ ok: true, configured: false });
  }

  let reachable = false;
  let authed = false;
  let reason: string | undefined;
  let world: Record<string, unknown> | null = null;

  try {
    world = await getMudConfig();
    reachable = true;
  } catch (err) {
    reason = err instanceof MudNodeError ? err.message : "node error";
  }

  if (reachable && mudHasToken()) {
    try {
      await getMudStats();
      authed = true;
    } catch (err) {
      reason = err instanceof MudNodeError ? err.message : reason;
    }
  }

  return Response.json({
    ok: true,
    configured: true,
    hasToken: mudHasToken(),
    reachable,
    authed,
    world,
    reason,
  });
}
