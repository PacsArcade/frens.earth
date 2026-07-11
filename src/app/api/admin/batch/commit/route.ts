import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { commitBatch, type BatchCommitItem } from "@/lib/registry";

/**
 * Ceremony step 2 — record an on-chain commit. Operator-gated. The Spaces node
 * (which holds the wallet and performed the actual Bitcoin commit) posts the
 * batch's on-chain id and each name's inclusion proof; this flips them
 * queued->committed (permanent). No keys here. See docs/spaces-anchoring.md.
 */
export async function POST(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }

  let body: { space?: string; batchId?: string; items?: BatchCommitItem[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }

  if (typeof body.batchId !== "string" || !body.batchId.trim()) {
    return Response.json({ ok: false, reason: "batchId required" }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return Response.json({ ok: false, reason: "items[] required" }, { status: 400 });
  }

  const result = await commitBatch(body.space, body.batchId.trim(), body.items);
  return Response.json(result);
}
