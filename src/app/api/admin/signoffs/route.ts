import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { listSignoffs, recordSignoff } from "@/lib/signoffs";

export const dynamic = "force-dynamic";

/* The sign-off board — cross-project approvals on Action Items. Operator-gated
   both ways: the cookie opens the room; the POST additionally verifies the
   signed sign-off action inside the store (the console's signed-action
   model — shape → freshness → allowlist → signature). */
export async function GET(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  return Response.json({ ok: true, signoffs: await listSignoffs() });
}

export async function POST(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  let body: { signoff?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }
  if (!body.signoff) {
    return Response.json({ ok: false, reason: "nothing to do — send a signed sign-off" }, { status: 400 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await recordSignoff(body.signoff as any);
  return Response.json(result, { status: result.ok ? 200 : 403 });
}
