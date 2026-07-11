import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { releaseHandle } from "@/lib/registry";

/**
 * Operator release — the trash button on the anchor queue: a name that got
 * registered incorrectly goes back to the pool. Queued names only —
 * releaseHandle refuses anything already etched (permanent is permanent).
 * Operator-gated; the fren-facing right-of-exit stays at /api/frens/release.
 */
export async function POST(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  let body: { handle?: string; space?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }
  const handle = (body.handle ?? "").trim().toLowerCase();
  if (!handle) return Response.json({ ok: false, reason: "handle required" }, { status: 400 });
  const result = await releaseHandle(handle, body.space);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
