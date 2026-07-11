import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { queuedEntries } from "@/lib/registry";
import { SPACE_NAME } from "@/lib/identity-config";

// The queue changes with every claim — never cache this.
export const dynamic = "force-dynamic";

/**
 * Ceremony step 1 — the queued set to anchor. Operator-gated (the same
 * fe-operator session as the rest of /admin). The Spaces node reads this,
 * commits the batch's Merkle root on-chain with the owner wallet, then calls
 * the /commit endpoint with the per-name proofs. See docs/spaces-anchoring.md.
 */
export async function GET(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  const space = new URL(request.url).searchParams.get("space") ?? SPACE_NAME;
  const queued = await queuedEntries(space);
  return Response.json({
    ok: true,
    space,
    count: queued.length,
    entries: queued.map((e) => ({
      handle: e.handle,
      npub: e.npub,
      requestedAt: e.requestedAt,
      blockHeight: e.blockHeight ?? null,
    })),
  });
}
