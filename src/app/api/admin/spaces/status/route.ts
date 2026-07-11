import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { spacesConfigured, getServerInfo, getSpaceOwner, SpacesNodeError } from "@/lib/spaces";
import { SPACE_NAME } from "@/lib/identity-config";

export const dynamic = "force-dynamic";

/**
 * Admin — is this deployment's Spaces node reachable, and does it own @<space>?
 * The backbone of the operator's "connect your node" setup panel and the seed
 * of the "look at the block" view (chain tip). Operator-gated. Never throws on
 * a down node — it reports reachable:false so the panel can guide setup.
 */
export async function GET(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  if (!(await spacesConfigured())) {
    return Response.json({ ok: true, configured: false });
  }
  const space = new URL(request.url).searchParams.get("space") ?? SPACE_NAME;
  try {
    const info = await getServerInfo();
    let spaceOwner: unknown = null;
    try {
      spaceOwner = await getSpaceOwner(space);
    } catch {
      spaceOwner = null; // ownership lookup failed but the node is up
    }
    return Response.json({
      ok: true,
      configured: true,
      reachable: true,
      space,
      chain: info.chain ?? null,
      tip: info.tip ?? null,
      spaceOwner,
    });
  } catch (err) {
    return Response.json({
      ok: true,
      configured: true,
      reachable: false,
      reason: err instanceof SpacesNodeError ? err.message : "node error",
    });
  }
}
