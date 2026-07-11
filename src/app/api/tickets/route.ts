import { frenFromRequest } from "@/lib/fren-auth";
import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { listTickets, raiseTicket, type TicketKind } from "@/lib/tickets";

export const dynamic = "force-dynamic";

/**
 * GET — the roster. The crew (operators) see every ticket; a signed-in fren
 * sees only the ones they raised. Signed out → 401.
 */
export async function GET(request: Request) {
  const operator = operatorFromCookieHeader(request.headers.get("cookie"));
  if (operator) {
    return Response.json({ ok: true, role: "crew", tickets: await listTickets() });
  }
  const fren = frenFromRequest(request);
  if (fren) {
    const who = `${fren.handle}@${fren.space}`;
    return Response.json({ ok: true, role: "fren", tickets: await listTickets({ raisedBy: who }) });
  }
  return Response.json({ ok: false, reason: "sign in to see tickets" }, { status: 401 });
}

/**
 * POST — raise a ticket. Customer-facing: only a signed-in fren can raise, and
 * it's stamped with their tag.
 */
export async function POST(request: Request) {
  const fren = frenFromRequest(request);
  if (!fren) {
    return Response.json(
      { ok: false, reason: "claim a @frens tag and sign in to raise a ticket" },
      { status: 401 }
    );
  }
  let body: { kind?: TicketKind; title?: string; detail?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }
  const result = await raiseTicket({
    kind: body.kind as TicketKind,
    title: body.title ?? "",
    detail: body.detail ?? "",
    raisedBy: `${fren.handle}@${fren.space}`,
  });
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
