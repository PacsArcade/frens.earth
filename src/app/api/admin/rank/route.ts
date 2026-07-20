import { nip19 } from "nostr-tools";
import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { findHandleByNpub, getEntry } from "@/lib/registry";
import { listTickets } from "@/lib/tickets";
import { serverBlockInfo } from "@/lib/chain-tip-server";
import { rankFor, SCAR_FLEET, type ScarRank } from "@/lib/ranks";
import { CONSOLE_OFFICERS } from "@/lib/console";
import { BLOCKS_PER_MONTH } from "@/lib/bb/bft";

export const dynamic = "force-dynamic";

/**
 * The operator's RANK TRACK — the lost trio's data door (rank / points /
 * commendations), restored with REAL reads only:
 *   • rank    — the SCAR fleet ladder (src/lib/ranks.ts) walked by Bitcoin-
 *     time tenure since the operator's tag claim (registry blockHeight →
 *     current tip). No per-fren cert store exists yet, so certs=0 — honest.
 *   • office  — Pac's identity ruling, display only (THE CAPTAIN / THE
 *     ADMIN); never auth (the key stays the operator).
 *   • points  — resolutions the operator logged on the duty roster.
 *   • commendations — resolved tickets per crew key, the board's own count.
 *     Ticket claims store an 8-char pubkey prefix, so other crew read as
 *     crew:<prefix> until their tags link — npub is plumbing, the tag is
 *     the name; we never invent one.
 */
export async function GET(request: Request) {
  const operator = operatorFromCookieHeader(request.headers.get("cookie"));
  if (!operator) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }

  let npub: string | null = null;
  try {
    npub = nip19.npubEncode(operator);
  } catch {
    npub = null;
  }

  /* the operator's tag — registry read; null is an honest answer */
  let tag: string | null = null;
  let office: string | null = null;
  let officeTag: string | null = null;
  let claimHeight: number | null = null;
  if (npub) {
    const found = await findHandleByNpub(npub).catch(() => null);
    if (found) {
      tag = `${found.handle}@${found.space}`;
      const officer = CONSOLE_OFFICERS.find(
        (o) => o.handle === found.handle && o.space === found.space
      );
      if (officer) {
        office = officer.role;
        officeTag = officer.display;
      }
      const entry = await getEntry(found.handle, found.space).catch(() => null);
      if (entry?.blockHeight != null) claimHeight = entry.blockHeight;
    }
  }

  const tip = await serverBlockInfo();
  const blocksSinceClaim =
    claimHeight != null ? Math.max(0, tip.height - claimHeight) : null;

  /* the ladder — tenure walks it; certs (none stored yet) would open the
     officer track. Flag tiers are appointed, so the office label rides
     BESIDE the ladder rank, never overwrites it. */
  let rank: ScarRank | null = null;
  let next: ScarRank | null = null;
  if (blocksSinceClaim != null) {
    rank = rankFor({ certs: 0, blocksSinceClaim });
    const idx = SCAR_FLEET.findIndex((r) => r.grade === rank!.grade);
    next = idx >= 0 && idx + 1 < SCAR_FLEET.length ? SCAR_FLEET[idx + 1] : null;
    if (next?.tier === "flag") next = null; // flag tiers are appointed, not farmed
  }

  /* points + commendations — the duty roster's own resolved counts */
  const tickets = await listTickets().catch(() => []);
  const me = operator.slice(0, 8);
  const byCrew = new Map<string, number>();
  for (const t of tickets) {
    if (t.status === "resolved" && t.claimedBy) {
      byCrew.set(t.claimedBy, (byCrew.get(t.claimedBy) ?? 0) + 1);
    }
  }
  const commendations = [...byCrew.entries()]
    .map(([who, n]) => ({
      who: who === me && tag ? tag : `crew:${who}`,
      n,
      you: who === me,
    }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);

  return Response.json({
    ok: true,
    tag,
    office,
    officeTag,
    rank: rank
      ? { grade: rank.grade, name: rank.name, abbrev: rank.abbrev, tier: rank.tier, draft: rank.draft }
      : null,
    next: next ? { grade: next.grade, name: next.name } : null,
    claimHeight,
    blocksSinceClaim,
    months: blocksSinceClaim != null ? Math.floor(blocksSinceClaim / BLOCKS_PER_MONTH) : null,
    tipEstimated: tip.estimated,
    points: byCrew.get(me) ?? 0,
    commendations,
  });
}
