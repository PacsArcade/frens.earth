/**
 * THE SKY'S MOON — the ONE moon, the only source of truth for the lunation.
 *
 * ONE MOON ONLY (owner ruling, 0018.05): there used to be two — this file's
 * real synodic moon, and a "calendar moon" in bft.ts that ran one fake
 * lunation per 28-day month. The calendar moon is DEAD. `moonPhase(height)`
 * in bft.ts now computes from this file's model; every surface — orrery,
 * half-wheel, converters, certs, buddy garden — shows the moon actually
 * over your head. The BFT calendar keeps its 28-day rhythm (block 0 =
 * Day 0 = genesis, untouched); the moon keeps her own, riding on top as
 * display flavor. Consequence, accepted: M01·D01 is NOT always a new moon.
 *
 * ⚠ WHY THE FAKE MOON DIED: BFT's month is 28 days; the real synodic month
 * is ~29.53 — ~1.53 days of drift PER MONTH, a full half-cycle in under ten
 * months. On 2026-07-28 the half-wheel read waning crescent while the moon
 * outside was full. Never again; one moon, honestly.
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
