/**
 * The SCAR Fleet — arcader ranks. Structure from the admiral's two source
 * charts (Federation officer insignia + Starfleet duty/dress ladder):
 * CADET tiers (T-01…T-04, the fren ladder) below COMMISSIONED tiers
 * (O-1…O-11, the crew ladder), each with duty + dress insignia slots.
 *
 * NAMES ARE DRAFT and the insignia are GLYPH's canvas — this file is the
 * plumbing: stable grades, progression hooks, and the one idea we're sure of:
 * the admiral tiers climb the SAME Bitcoin-time ladder as the cert cases —
 * block → epoch → halving → astronomical. One time-lore system everywhere.
 *
 * Spark (Pac): rank movements ride the newsletters.
 */

export interface ScarRank {
  grade: string; // stable id — "T-01" … "O-11"
  name: string; // DRAFT until GLYPH's pass
  abbrev: string;
  tier: "cadet" | "officer" | "flag";
  draft: boolean;
  /** insignia slots — duty (the floor) and dress (the ceremony). GLYPH. */
  insignia: { duty: string | null; dress: string | null };
}

const r = (
  grade: string,
  name: string,
  abbrev: string,
  tier: ScarRank["tier"],
  draft = true
): ScarRank => ({ grade, name, abbrev, tier, draft, insignia: { duty: null, dress: null } });

export const SCAR_FLEET: ScarRank[] = [
  // ── the fren ladder — every player is already enlisted ──
  r("T-01", "COIN CADET", "C1", "cadet"),
  r("T-02", "PIXEL CADET", "C2", "cadet"),
  r("T-03", "SPRITE CADET", "C3", "cadet"),
  r("T-04", "SENIOR CADET", "C4", "cadet"),
  // ── the crew ladder ──
  r("O-1", "FLOOR ENSIGN", "Ens.", "officer"),
  r("O-2", "JUNIOR LIEUTENANT", "Lt. jg.", "officer"),
  r("O-3", "LIEUTENANT", "Lt.", "officer"),
  r("O-4", "LIEUTENANT COMMANDER", "Lt. Cdr.", "officer"),
  r("O-5", "COMMANDER", "Cdr.", "officer"),
  r("O-6", "CAPTAIN", "Capt.", "officer"),
  r("O-6A", "FLEET CAPTAIN", "F. Capt.", "officer"),
  r("O-7", "COMMODORE", "Cmdre.", "officer"),
  // ── the flag tiers — the Bitcoin-time ladder, same as the cert cases ──
  r("O-8", "BLOCK ADMIRAL", "B. Adm.", "flag", false),
  r("O-9", "EPOCH ADMIRAL", "E. Adm.", "flag", false),
  r("O-10", "HALVING ADMIRAL", "H. Adm.", "flag", false),
  r("O-11", "ASTRONOMICAL ADMIRAL", "A. Adm.", "flag", false), // the cat's tier 🐈
];

export function rankByGrade(grade: string): ScarRank | undefined {
  return SCAR_FLEET.find((x) => x.grade === grade);
}

/**
 * DRAFT progression — the hook, not the doctrine. Certs open the officer
 * ladder; Bitcoin-time tenure climbs it (blocks since claim, in BFT months
 * of 4032). Tune with the crew; KHA0S is fought with clear ladders.
 */
export function rankFor(input: { certs: number; blocksSinceClaim: number }): ScarRank {
  const months = Math.floor(input.blocksSinceClaim / 4032);
  if (input.certs <= 0) {
    // cadets climb by showing up — one tier per BFT month
    return SCAR_FLEET[Math.min(3, months)];
  }
  // officers: certs gate the door, tenure walks the hall
  const officerIdx = 4 + Math.min(7, input.certs - 1 + Math.floor(months / 3));
  return SCAR_FLEET[Math.min(officerIdx, 11)]; // flag tiers are appointed, not farmed
}
