import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { listSignoffs } from "@/lib/signoffs";
import { listDecisions } from "@/lib/decisions";
import { listBriefs } from "@/lib/briefs";
import { listTickets } from "@/lib/tickets";
import { SEED_FLIGHT } from "@/lib/status-flight";

export const dynamic = "force-dynamic";

/**
 * Console counts — ONE cheap read feeding every count pill in the ribbon
 * accordion and the Overview's needs-you cards, so the numbers on the rail
 * and the numbers on the boards always agree (one taxonomy, counts match the
 * list). Store reads only — nothing here phones GitHub, so sub-items whose
 * counts would need the API (approvals, in-testing) simply carry no pill.
 */
export async function GET(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  const [signoffs, decisions, briefs, tickets] = await Promise.all([
    listSignoffs().catch(() => []),
    listDecisions().catch(() => []),
    listBriefs().catch(() => []),
    listTickets().catch(() => []),
  ]);
  const openSignoffs = signoffs.filter((s) => s.status === "open").length;
  const openDecisions = decisions.filter((d) => d.status === "open").length;
  const unreviewedBriefs = briefs.filter((b) => b.status === "unreviewed").length;
  const counts: Record<string, number> = {
    // action items
    signoffs: openSignoffs,
    decisions: openDecisions,
    // status reports — the gesture buckets (sign · review · vote share sources)
    flight: SEED_FLIGHT.length,
    sign: openSignoffs,
    review: unreviewedBriefs,
    vote: openDecisions,
    // briefs tiers
    briefsShared: briefs.filter((b) => b.tier === "shared").length,
    briefsPersonal: briefs.filter((b) => b.tier === "personal").length,
    // testing — the duty roster
    tickets: tickets.filter((t) => t.status !== "resolved").length,
  };
  return Response.json({ ok: true, counts });
}
