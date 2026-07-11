import { bft, bftDate, moonPhase, yearAnimal, BLOCKS_PER_MONTH } from "./bb/bft";

/**
 * Cert cases — video-game box art for certs, rarity told by BITCOIN TIME.
 *
 * Like the NES era: most games shipped in grey plastic, but The Legend of
 * Zelda came in GOLD. A cert's case is decided by the block it was etched at —
 * deterministic, verifiable, teachable ("look at the block"). No randomness,
 * no scarcity theater: the calendar IS the rarity.
 *
 *   GREY CART     any block — the honest classic
 *   SILVER        etched on a full-moon day (block-timed lunation)
 *   GOLD          etched on a difficulty-epoch boundary day (height % 2016
 *                 < 144 — the first day of a new epoch) — the Zelda cart
 *   CRYSTAL       etched on BFT New Year (M01·D01 — always a new moon)
 *   ASTRONOMICAL  etched within a day of a halving (height % 210000 < 144) —
 *                 the 13th tier, where the Astronomical Cat lives
 *
 * Ties straight into the BFT clock (13 × 28 × 144) the site already runs on.
 */

export type CertTier = "grey" | "silver" | "gold" | "crystal" | "astronomical";

export interface CertCaseSpec {
  tier: CertTier;
  caseName: string; // "GOLD CART" — the collector's word
  why: string; // the time-lore that earned it
  bftDate: string; // a₿ YYYY.MM.DD
  moon: string; // moon emoji at etch
  animal: string; // year animal emoji
  height: number;
}

const CASE_NAMES: Record<CertTier, string> = {
  grey: "GREY CART",
  silver: "SILVER CART",
  gold: "GOLD CART",
  crystal: "CRYSTAL CASE",
  astronomical: "ASTRONOMICAL",
};

/** Blocks into the current day-of-calendar for boundary checks (one BFT day = 144). */
const DAY = 144;

/** The case a cert etched at `height` ships in — pure function of the block. */
export function certCase(height: number): CertCaseSpec {
  const d = bft(height);
  const moon = moonPhase(height);
  const animal = yearAnimal(height);

  let tier: CertTier = "grey";
  let why = "etched on an honest working day";
  if (moon.index === 4) {
    tier = "silver";
    why = "etched under a full moon";
  }
  if (height % 2016 < DAY) {
    tier = "gold";
    why = "etched on the first day of a difficulty epoch";
  }
  if (d.month === 1 && d.day === 1) {
    tier = "crystal";
    why = "etched on the Bitcoin new year — a new moon, a new ring";
  }
  if (height % 210000 < DAY) {
    tier = "astronomical";
    why = "etched in the shadow of a halving — the cat's tier";
  }

  return {
    tier,
    caseName: CASE_NAMES[tier],
    why,
    bftDate: bftDate(height),
    moon: moon.emoji,
    animal: animal.emoji,
    height,
  };
}

/** A cert as the profile shelf renders it — issuer data lands here when the
    rune index gets its HTTP bridge; shape kept minimal on purpose. */
export interface Cert {
  code: string; // "SOCIAL101"
  title: string; // "Social Basics"
  etchedAt: number; // block height of the etch
  rune?: string; // "PAC•SOCIAL101" once etched
}

/** Specimen shelf for the dressing room — one of each case, real BFT lore.
    Heights chosen to hit each tier deterministically. */
export function specimenShelf(): (Cert & { spec: CertCaseSpec })[] {
  const pick = (tier: CertTier, from: number): number => {
    for (let h = from; h < from + BLOCKS_PER_MONTH * 14; h++) {
      if (certCase(h).tier === tier) return h;
    }
    return from;
  };
  const base = 840000; // the 2024 halving — a known astronomical block
  const specs: [string, string, number][] = [
    ["SOCIAL101", "Social Basics", pick("grey", base + 300)],
    ["KEYS201", "Self-Custody", pick("silver", base + 300)],
    ["CHAIN301", "Proof & Verification", pick("gold", base + 2016)],
    ["TIME401", "The Bitcoin Calendar", pick("crystal", base + 300)],
    ["GENESIS", "The Halving Watch", base],
  ];
  return specs.map(([code, title, h]) => ({
    code,
    title,
    etchedAt: h,
    rune: `PAC•${code}`,
    spec: certCase(h),
  }));
}
