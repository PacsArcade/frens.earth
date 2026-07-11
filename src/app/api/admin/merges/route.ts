import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { listOpenPrs, listAuthorizations, authorizeMerge, mergeExecutionEnabled } from "@/lib/merges";

export const dynamic = "force-dynamic";

/* The merge queue — open PRs joined with their signed authorizations.
   Operator-gated both ways; the POST additionally verifies the per-action
   signature inside (the cookie opens the room, the signature moves the ship). */
export async function GET(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  const auths = await listAuthorizations();
  const canExecute = await mergeExecutionEnabled();
  try {
    const prs = await listOpenPrs();
    return Response.json({ ok: true, canExecute, prs, auths });
  } catch (err) {
    /* Private repo without a token (404), rate limit, or GitHub down — the
       lane still opens with the connect box + the audit log intact. */
    return Response.json({
      ok: true,
      canExecute,
      prs: [],
      auths,
      setup: canExecute
        ? `couldn't reach GitHub (${err instanceof Error ? err.message : "error"}) — try again`
        : "connect-github",
    });
  }
}

export async function POST(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  let body: { event?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await authorizeMerge(body.event as any);
  return Response.json(result, { status: result.ok ? 200 : 403 });
}
