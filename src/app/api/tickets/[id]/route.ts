import { frenFromRequest } from "@/lib/fren-auth";
import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { claimTicket, resolveTicket, reopenTicket, addTicketNote } from "@/lib/tickets";

export const dynamic = "force-dynamic";

/**
 * POST an action on one ticket.
 *   claim / resolve / reopen — WORK actions, admiral + crew (operators) only.
 *   note — the crew, or the fren who raised it, may comment.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const operator = operatorFromCookieHeader(request.headers.get("cookie"));
  const fren = frenFromRequest(request);

  let body: { action?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }

  if (body.action === "claim" || body.action === "resolve" || body.action === "reopen") {
    if (!operator) {
      return Response.json({ ok: false, reason: "only the crew can work tickets" }, { status: 403 });
    }
    const op = operator.slice(0, 8);
    const t =
      body.action === "claim"
        ? await claimTicket(id, op)
        : body.action === "resolve"
          ? await resolveTicket(id, op)
          : await reopenTicket(id);
    return t
      ? Response.json({ ok: true, ticket: t })
      : Response.json({ ok: false, reason: "ticket not found" }, { status: 404 });
  }

  if (body.action === "note") {
    const who = operator
      ? `crew:${operator.slice(0, 8)}`
      : fren
        ? `${fren.handle}@${fren.space}`
        : null;
    if (!who) return Response.json({ ok: false, reason: "sign in to comment" }, { status: 401 });
    const t = await addTicketNote(id, who, body.note ?? "");
    return t
      ? Response.json({ ok: true, ticket: t })
      : Response.json({ ok: false, reason: "empty note or ticket not found" }, { status: 400 });
  }

  return Response.json({ ok: false, reason: "unknown action" }, { status: 400 });
}
