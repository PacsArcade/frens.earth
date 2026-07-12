import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { listDecisions, recordDecision } from "@/lib/decisions";

export const dynamic = "force-dynamic";

/* The decisions room — pending rulings as action cards. Operator-gated both
   ways: the cookie opens the room, the POST records the admiral's choice
   (validated against the decision's own options inside the store). */
export async function GET(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  return Response.json({ ok: true, decisions: await listDecisions() });
}

export async function POST(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  let body: { id?: string; choice?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }
  if (!body.id || !body.choice) {
    return Response.json({ ok: false, reason: "id and choice required" }, { status: 400 });
  }
  const result = await recordDecision(body.id, body.choice, body.note);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
