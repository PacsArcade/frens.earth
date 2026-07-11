/**
 * Bitcoin Federated Time for /bb — a TypeScript port of the canonical clock
 * (`knowledge-engine/services/common/bft.py` + `docs/BFT.md`).
 *
 * 13 months × 28 days × 144 blocks/day; genesis = a₿ 0. Dates render ₿-marked
 * ("a₿ 0016.05.23") so they read as bitcoin dates. The moon is block-timed —
 * one lunation per 28-day month — and each year carries a 12-animal sign
 * (AB 0 / 2009 = Ox; new year M01·D01 is a new moon). Signs are lore, not
 * finance (same house rule as the Observatory's zodiac).
 */

export const BLOCKS_PER_DAY = 144;
export const BLOCKS_PER_MONTH = 4032; // 28 days · 2 difficulty epochs
export const BLOCKS_PER_YEAR = 52416; // 13 months · 26 difficulty epochs
const GENESIS_MS = Date.UTC(2009, 0, 3); // 2009-01-03, block 0

export interface BftDate {
  year: number;
  month: number; // 1..13
  day: number; // 1..28
  height: number;
}

export function bft(height: number): BftDate {
  const rem = ((height % BLOCKS_PER_YEAR) + BLOCKS_PER_YEAR) % BLOCKS_PER_YEAR;
  return {
    year: Math.floor(height / BLOCKS_PER_YEAR),
    month: Math.floor(rem / BLOCKS_PER_MONTH) + 1,
    day: Math.floor((rem % BLOCKS_PER_MONTH) / BLOCKS_PER_DAY) + 1,
    height,
  };
}

const pad = (n: number, w: number) => String(n).padStart(w, "0");

/** ₿-marked After-Bitcoin date, marker AFTER the date (Pac, 2026-07-11):
    "0016.05.23 a₿". */
export function bftDate(height: number): string {
  const b = bft(height);
  return `${pad(b.year, 4)}.${pad(b.month, 2)}.${pad(b.day, 2)} a₿`;
}

/* The display standard (Pac, 2026-07-11): date = yyyy.mm.dd · time = hh:mm
   (the 144-block day mapped onto a 24h clock — 6 blocks an hour, ten
   "minutes" a block) · date+time = "yyyy.mm.dd hh:mm". The a₿ marker is
   ASSUMED on new items (queues, requests, logs) — no prefix clutter. */

/** Plain BFT date, marker assumed: "0018.04.15". */
export function bftDatePlain(height: number): string {
  const b = bft(height);
  return `${pad(b.year, 4)}.${pad(b.month, 2)}.${pad(b.day, 2)}`;
}

/** BFT time of day, 24h: block-in-day → "hh:mm" (steps of 10). */
export function bftTime(height: number): string {
  const bid = ((height % BLOCKS_PER_DAY) + BLOCKS_PER_DAY) % BLOCKS_PER_DAY;
  return `${pad(Math.floor(bid / 6), 2)}:${pad((bid % 6) * 10, 2)}`;
}

/** Full stamp: "yyyy.mm.dd hh:mm" — the standard for new items. */
export function bftDateTime(height: number): string {
  return `${bftDatePlain(height)} ${bftTime(height)}`;
}

/** Pre-genesis wall-clock (negative-time / ghost side), marker after:
    "yyyy.dd.mm[.ss] b₿". */
export function beforeBitcoin(year: number, month: number, day: number, second?: number): string {
  const base = `${pad(year, 4)}.${pad(day, 2)}.${pad(month, 2)}`;
  return `${second == null ? base : `${base}.${pad(second, 2)}`} b₿`;
}

export const MOON_PHASES: ReadonlyArray<readonly [string, string]> = [
  ["🌑", "New"], ["🌒", "Waxing Crescent"], ["🌓", "First Quarter"], ["🌔", "Waxing Gibbous"],
  ["🌕", "Full"], ["🌖", "Waning Gibbous"], ["🌗", "Last Quarter"], ["🌘", "Waning Crescent"],
];

/** One lunation per BFT month → phase is a pure function of the day-of-month. */
export function moonPhase(height: number): { emoji: string; name: string; index: number } {
  const day = bft(height).day;
  const index = Math.round(((day - 1) / 28) * 8) % 8;
  const [emoji, name] = MOON_PHASES[index];
  return { emoji, name, index };
}

// 13 animals — the traditional 12 plus the CAT as the 13th (Pac, 2026-07-10). The cat is the
// famous "left-out" sign of the Great Race (the Rat tricked it) and a real sign in the Vietnamese
// zodiac; BB seats it as the 13th to match the 13-month year (and Ophiuchus, the 13th sign). Here
// it's the "Astronomical Cat" — the flying cat of Adult Swim's Perfect Hair Forever.
const YEAR_ANIMALS: ReadonlyArray<readonly [string, string]> = [
  ["🐀", "Rat"], ["🐂", "Ox"], ["🐅", "Tiger"], ["🐇", "Rabbit"], ["🐉", "Dragon"], ["🐍", "Snake"],
  ["🐎", "Horse"], ["🐐", "Goat"], ["🐒", "Monkey"], ["🐓", "Rooster"], ["🐕", "Dog"], ["🐖", "Pig"],
  ["🐈", "Astronomical Cat"],
];

/** 13-animal year sign. AB 0 (2009) = Ox; the new year falls on a new moon (M01·D01). */
export function yearAnimal(height: number): { emoji: string; name: string } {
  const [emoji, name] = YEAR_ANIMALS[(bft(height).year + 1) % 13];
  return { emoji, name };
}

/** 13 astronomical signs incl. Ophiuchus (order per calendar_lore.py). */
const SIGNS: ReadonlyArray<readonly [string, string]> = [
  ["Capricorn", "♑"], ["Aquarius", "♒"], ["Pisces", "♓"], ["Aries", "♈"], ["Taurus", "♉"], ["Gemini", "♊"],
  ["Cancer", "♋"], ["Leo", "♌"], ["Virgo", "♍"], ["Libra", "♎"], ["Scorpio", "♏"], ["Ophiuchus", "⛎"], ["Sagittarius", "♐"],
];

const ELEMENTS = ["Ember", "Sprout", "Tidal", "Stone", "Static", "Gale"];
const TEMPERS = ["Cheery", "Grumpy", "Curious", "Sleepy", "Feral", "Zen"];
const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];

export interface BuddyTraits {
  element: string;
  temper: string;
  rarity: string;
  zodiac: string;
  zodiacGlyph: string;
}

/** Deterministic on-chain-style biology from the birth block + name (design notes Part 3). */
export function deriveTraits(bornBlock: number, name: string): BuddyTraits {
  let h = 2166136261 >>> 0;
  for (const c of String(bornBlock) + name) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const [zodiac, zodiacGlyph] = SIGNS[(bft(bornBlock).month - 1) % 13];
  return {
    element: ELEMENTS[h % ELEMENTS.length],
    temper: TEMPERS[(h >>> 3) % TEMPERS.length],
    rarity: RARITIES[(h >>> 6) % RARITIES.length],
    zodiac,
    zodiacGlyph,
  };
}

/**
 * Best-effort current block height, "tied to bitcoin": fetch the real chain tip
 * from mempool.space, falling back to a genesis-anchored estimate (~10 min/block)
 * if the network is unavailable. Cached briefly so a page doesn't hammer the API.
 */
let _tipCache: { height: number; at: number } | null = null;

export function estimateHeight(nowMs = Date.now()): number {
  return Math.max(0, Math.floor((nowMs - GENESIS_MS) / 600_000));
}

export async function currentBlock(): Promise<number> {
  const now = Date.now();
  if (_tipCache && now - _tipCache.at < 60_000) return _tipCache.height;
  try {
    const res = await fetch("https://mempool.space/api/blocks/tip/height", { cache: "no-store" });
    if (res.ok) {
      const h = parseInt((await res.text()).trim(), 10);
      if (Number.isFinite(h) && h > 0) {
        _tipCache = { height: h, at: now };
        return h;
      }
    }
  } catch {
    /* offline / blocked → fall through to the estimate */
  }
  return estimateHeight(now);
}
