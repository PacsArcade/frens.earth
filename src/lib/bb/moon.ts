/**
 * THE SKY'S MOON — one source of truth for the real lunation.
 *
 * There are TWO moons in this codebase and they are not the same thing:
 *
 * 1. THE CALENDAR MOON — `moonPhase(height)` in bft.ts. BFT runs one
 *    lunation per 28-day month by construction, so the phase is a pure
 *    function of the day-of-month. That is deliberate, it is what makes a
 *    BFT date self-describing, and certs.ts leans on it. It is NOT the sky.
 *
 * 2. THE SKY MOON — this file. The actual moon over your head, mean synodic
 *    from a known new moon. This is what the orrery has always drawn (the
 *    pupil study's moon) and what any surface claiming to show "the moon"
 *    must use.
 *
 * ⚠ WHY THEY DRIFT, AND WHY IT BIT US: BFT's month is 28 days; the real
 * synodic month is ~29.53. That is ~1.53 days of drift PER MONTH — a full
 * half-cycle in under ten months. The half-wheel was showing the calendar
 * moon on a ring whose own modulus (4252 blocks ≈ 29.53 days) promised the
 * sky one, so on 2026-07-28 it read waning crescent while the moon outside
 * was full. The two can never be quietly swapped for one another.
 *
 * Anchor: the new moon of 2000-01-06 18:14 UTC, mean synodic period. This is
 * wonder-grade (~), not an ephemeris — no perturbations, so the true phase
 * can differ by several hours. That is well inside one of eight phase names.
 */

export const SYNODIC_DAYS = 29.530588853;
export const NEW_MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14);

export const SKY_MOONS: ReadonlyArray<readonly [string, string]> = [
  ["🌑", "New Moon"],
  ["🌒", "Waxing Crescent"],
  ["🌓", "First Quarter"],
  ["🌔", "Waxing Gibbous"],
  ["🌕", "Full Moon"],
  ["🌖", "Waning Gibbous"],
  ["🌗", "Last Quarter"],
  ["🌘", "Waning Crescent"],
];

/** Where we are in the lunation, 0..1 — 0 is new, 0.5 is full. */
export function moonFracAt(ms: number): number {
  const days = (ms - NEW_MOON_EPOCH_MS) / 86_400_000;
  return (((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS) / SYNODIC_DAYS;
}

/** Days since the new moon, 0 .. ~29.5 — the moon's age. */
export function moonAgeDays(ms: number): number {
  return moonFracAt(ms) * SYNODIC_DAYS;
}

/**
 * Lit fraction of the disc, 0 (new) .. 1 (full).
 * Anchored to the REAL new moon — the half-wheel's old version ran the same
 * cosine off block height 0, which gave the right rhythm at the wrong phase.
 */
export function moonIlluminationAt(ms: number): number {
  return (1 - Math.cos(2 * Math.PI * moonFracAt(ms))) / 2;
}

/** The phase as a face and a name. Eight buckets, nearest wins. */
export function skyMoon(ms: number): {
  emoji: string;
  name: string;
  index: number;
  frac: number;
  ageDays: number;
} {
  const frac = moonFracAt(ms);
  const index = Math.round(frac * 8) % 8;
  const [emoji, name] = SKY_MOONS[index];
  return { emoji, name, index, frac, ageDays: frac * SYNODIC_DAYS };
}
