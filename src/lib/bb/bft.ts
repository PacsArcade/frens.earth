/**
 * Bitcoin Federated Time for /bb — a TypeScript port of the canonical clock
 * (`knowledge-engine/services/common/bft.py` + `docs/BFT.md`).
 *
 * 13 months × 28 days × 144 blocks/day; genesis = a₿ 0. Dates render ₿-marked
 * ("a₿ 0016.05.23") so they read as bitcoin dates. THE MOON IS THE SKY'S —
 * one real synodic moon (lib/bb/moon.ts), everywhere (owner ruling,
 * 0018.05: the 28-day calendar lunation is retired; M01·D01 is a calendar
 * day, not a moon claim). Each year carries a 13-animal sign (AB 0 / 2009 =
 * Ox). Signs are lore, not finance (same house rule as the Observatory's
 * zodiac).
 */

import { SYNODIC_DAYS, NEW_MOON_EPOCH_MS } from "./moon";

export const BLOCKS_PER_DAY = 144;
export const BLOCKS_PER_MONTH = 4032; // 28 days · 2 difficulty epochs
export const BLOCKS_PER_YEAR = 52416; // 13 months · 26 difficulty epochs
export const GENESIS_MS = Date.UTC(2009, 0, 3); // 2009-01-03, block 0

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

/** THE SKY'S OWN MOON (one moon only — owner ruling): phase from the real
 *  synodic month (29.530588853 days) anchored to the known new moon of
 *  2000-01-06 18:14 UTC (lib/bb/moon.ts) — not the calendar day. The 28-day
 *  month is our RHYTHM; the moon keeps her own, and the clock honors the
 *  sky. Ported from the onecocreation reference lib (src/lib/bb/bft.ts).
 *
 *  `atMs` — the wall instant this height belongs to. Callers who KNOW it
 *  (a live tip = Date.now(); a date-derived height = that date) must pass
 *  it. The default is the CHAIN_ANCHORS estimate below — never the flat
 *  10-min genesis model, which drifts ~250 days by 2026 (the honest-now
 *  law) — so even the default lands in the right lunation. */
export function moonPhase(
  height: number,
  atMs: number = estimateMsAtHeight(height),
): { emoji: string; name: string; index: number } {
  const days = (atMs - NEW_MOON_EPOCH_MS) / 86_400_000;
  const age = ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
  const index = Math.round((age / SYNODIC_DAYS) * 8) % 8;
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

/** 13-animal year sign. AB 0 (2009) = Ox. */
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
 * Best-effort current block height, "tied to bitcoin". Sovereignty fix (the
 * admiral, 2026-07-11): read the tip from the fleet's OWN door — the same-origin
 * /api/chain/tip proxy, which reads the admiral's configured mempool node (its
 * own instance when pointed, the public mempool.space only as a fallback). If
 * the proxy is unreachable (e.g. server-side render, offline), fall back to a
 * direct mempool.space read, then to a genesis-anchored estimate (~10 min/block).
 * Cached briefly so a page doesn't hammer anything.
 */
let _tipCache: { height: number; at: number; tipTimestamp: number | null } | null = null;

/** Heights the chain passed on well-recorded days (the halvings). The network
 * has averaged FASTER than 600s/block for most of its life, so a pure
 * genesis ÷ 10min guess drifts ~250 days behind by 2026 — these anchors keep
 * a date→height estimate honest in every era. */
const CHAIN_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [GENESIS_MS, 0],
  [Date.UTC(2012, 10, 28), 210_000],
  [Date.UTC(2016, 6, 9), 420_000],
  [Date.UTC(2020, 4, 11), 630_000],
  [Date.UTC(2024, 3, 20), 840_000],
];

/**
 * Date → ~height, anchored. Interpolates between chain anchors for historical
 * dates; when the live tip is known it becomes the final anchor, so "today"
 * lands on today's height and futures extend from the real tip at 600s/block.
 */
export function estimateHeightAt(
  utcMs: number,
  tip?: number | null,
  tipAtMs = Date.now(),
): number {
  const anchors: Array<readonly [number, number]> = [...CHAIN_ANCHORS];
  const lastFixed = anchors[anchors.length - 1];
  if (tip != null && tip > lastFixed[1] && tipAtMs > lastFixed[0]) {
    anchors.push([tipAtMs, tip]);
  }
  if (utcMs <= GENESIS_MS) {
    return Math.floor((utcMs - GENESIS_MS) / 600_000);
  }
  const last = anchors[anchors.length - 1];
  if (utcMs >= last[0]) {
    return Math.max(0, Math.round(last[1] + (utcMs - last[0]) / 600_000));
  }
  for (let i = 1; i < anchors.length; i++) {
    if (utcMs <= anchors[i][0]) {
      const [t0, h0] = anchors[i - 1];
      const [t1, h1] = anchors[i];
      return Math.max(0, Math.round(h0 + ((utcMs - t0) / (t1 - t0)) * (h1 - h0)));
    }
  }
  return Math.max(0, Math.floor((utcMs - GENESIS_MS) / 600_000));
}

export function estimateHeight(nowMs = Date.now()): number {
  return estimateHeightAt(nowMs);
}

/** Height → ~wall instant (ms): the piecewise inverse of `estimateHeightAt`
 *  over the same CHAIN_ANCHORS, 600s/block beyond the last. An estimate —
 *  but anchored, so a historical height lands in the right season (and the
 *  right lunation for `moonPhase`); the flat genesis model does not. */
export function estimateMsAtHeight(height: number): number {
  if (height <= 0) return GENESIS_MS + height * 600_000;
  const [tLast, hLast] = CHAIN_ANCHORS[CHAIN_ANCHORS.length - 1];
  if (height >= hLast) return tLast + (height - hLast) * 600_000;
  for (let i = 1; i < CHAIN_ANCHORS.length; i++) {
    if (height <= CHAIN_ANCHORS[i][1]) {
      const [t0, h0] = CHAIN_ANCHORS[i - 1];
      const [t1, h1] = CHAIN_ANCHORS[i];
      return Math.round(t0 + ((height - h0) / (h1 - h0)) * (t1 - t0));
    }
  }
  return GENESIS_MS + height * 600_000;
}

/** The anchored model's own mine-instant (ms) for an ESTIMATED "now" height —
 *  the moment `estimateHeight` first answers `height`. Offline clock faces
 *  seed their block age here so the ~ seconds tick continuously with the
 *  model instead of restarting at page load (the honest-clock law: an age
 *  must never restart at :00 on reload). Estimate only — wear the `~`. */
export function estimatedBlockAtMs(height: number): number {
  const [t0, h0] = CHAIN_ANCHORS[CHAIN_ANCHORS.length - 1];
  return t0 + (height - 0.5 - h0) * 600_000;
}

/** `estimated: true` = the network was unreachable and the height is a
    genesis-anchored ~10-min/block guess — display it with the honest `~`. */
export interface BlockInfo {
  height: number;
  estimated: boolean;
  /** unix seconds the tip block was mined — the CHAIN's own anchor for the
      block age, so every clock agrees on Pac's lap and the seconds no
      matter when the page loaded (`?full=1` reading). Null when only a
      bare height was known. */
  tipTimestamp: number | null;
}

export async function currentBlockInfo(opts?: { fresh?: boolean }): Promise<BlockInfo> {
  const now = Date.now();
  if (!opts?.fresh && _tipCache && now - _tipCache.at < 60_000)
    return { height: _tipCache.height, estimated: false, tipTimestamp: _tipCache.tipTimestamp };

  // the fleet's own door first — /api/chain/tip reads the configured node
  // (?full=1 adds the tip's own timestamp: the strip clock's seconds anchor)
  // The 10 s deadline on every knock: a request left hanging across a laptop
  // sleep or a network change must never out-live the reading that asked.
  try {
    const res = await fetch("/api/chain/tip?full=1", {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const d = await res.json();
      if (d?.ok && Number.isFinite(d.height) && d.height > 0) {
        const ts =
          typeof d.tipTimestamp === "number" && Number.isFinite(d.tipTimestamp) ? d.tipTimestamp : null;
        _tipCache = { height: d.height, at: now, tipTimestamp: ts };
        return { height: d.height, estimated: false, tipTimestamp: ts };
      }
    }
  } catch {
    /* proxy unreachable (SSR / offline) → try the direct read below */
  }

  // fallback: direct mempool.space read (relative fetch can't resolve
  // server-side, and the proxy may be down) — keeps the clock ticking
  try {
    const res = await fetch("https://mempool.space/api/blocks/tip/height", {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const h = parseInt((await res.text()).trim(), 10);
      if (Number.isFinite(h) && h > 0) {
        _tipCache = { height: h, at: now, tipTimestamp: null };
        return { height: h, estimated: false, tipTimestamp: null };
      }
    }
  } catch {
    /* offline / blocked → fall through to the estimate */
  }
  return { height: estimateHeight(now), estimated: true, tipTimestamp: null };
}

export async function currentBlock(): Promise<number> {
  return (await currentBlockInfo()).height;
}
