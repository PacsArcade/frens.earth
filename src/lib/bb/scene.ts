/**
 * Bitcoin Buddy — the BFT-procedural garden.
 *
 * EVERYTHING behind the buddy is a pure function of the chain (Pac's order,
 * 0018.04.15 a₿): the beat (block-of-day, 0–143) sets the light — dawn, day,
 * dusk, night; the moon phase draws the moon AND brightens the night; the BFT
 * month (1–13) shifts a seasonal tint across the year; the year-animal hangs
 * in the sky as a faint constellation; the hills reseed on every block so the
 * garden literally shifts with the chain. Same height in = same garden out,
 * on every node, every time — block height IS the timestamp.
 *
 * Perf contract (the /bb lesson from 83f119e): `drawBftBackground` paints the
 * whole static scene ONCE per block into an offscreen canvas; the device's
 * rAF loop only blits it. No gradients, no fillText, no path math per frame.
 *
 * Palette: the night-garden house colors only. NO gold — gold is for money,
 * and there is no money on this screen (house rule).
 */

import { bft, moonPhase, yearAnimal, BLOCKS_PER_DAY } from "./bft";

export interface BftScene {
  height: number;
  /** Block-of-day, 0–143 — the BFT beat that sets the light. */
  beat: number;
  /** 0 = broad day … 1 = deep night (drives stars, moon, constellation). */
  night: number;
  /** 0 = no sun … 1 = high sun (drives the day disc). */
  daylight: number;
  moonIndex: number;
  moonEmoji: string;
  moonName: string;
  /** 0 = new moon … 1 = full — a full moon lights the garden brighter. */
  moonIllum: number;
  month: number; // 1..13 — the seasonal palette wheel
  day: number; // 1..28
  animalName: string;
}

/** Everything the background needs, derived deterministically from height. */
export function bftScene(height: number): BftScene {
  const d = bft(height);
  const beat = ((height % BLOCKS_PER_DAY) + BLOCKS_PER_DAY) % BLOCKS_PER_DAY;
  // Sun elevation on the 144-beat day: beat 72 = noon (+1), beat 0 = midnight (−1).
  const elev = Math.cos(((beat - 72) / BLOCKS_PER_DAY) * Math.PI * 2);
  const mp = moonPhase(height);
  return {
    height,
    beat,
    night: clamp01((0.2 - elev) / 0.65),
    daylight: clamp01((elev - 0.2) / 0.35),
    moonIndex: mp.index,
    moonEmoji: mp.emoji,
    moonName: mp.name,
    moonIllum: 1 - Math.abs(mp.index - 4) / 4,
    month: d.month,
    day: d.day,
    animalName: yearAnimal(height).name,
  };
}

/* ── deterministic seeds — the same FNV pattern deriveTraits uses ── */

function fnv(seed: string): number {
  let h = 2166136261 >>> 0;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** mulberry32 — a tiny seeded PRNG so hills/stars are stable per seed. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── color math (numeric RGB so blends can stack) ── */

type RGB = [number, number, number];
const rgb = (hex: string): RGB => [
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
];
const lerp3 = (a: RGB, b: RGB, t: number): RGB =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: RGB) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Sky keyframes (top / mid / horizon) — night-garden all the way down. */
const SKY: Record<"night" | "dawn" | "day" | "dusk", [RGB, RGB, RGB]> = {
  night: [rgb("#0c1a14"), rgb("#0a130e"), rgb("#0a0f0c")],
  dawn: [rgb("#11201c"), rgb("#22302a"), rgb("#4a3550")], // lavender-rose first light
  day: [rgb("#21504a"), rgb("#2a5f4b"), rgb("#356b4e")], // muted garden daylight
  dusk: [rgb("#121e2b"), rgb("#252a3d"), rgb("#54334a")], // violet-rose evening
};

/**
 * The 13-month seasonal wheel — one tint per BFT month, mixed lightly into
 * sky and ground. Winter ice → sprout spring → rose summer → copper autumn.
 * (Copper/russet, never coin-gold — gold means money and none is on screen.)
 */
const SEASON: RGB[] = [
  rgb("#53e0d4"), // M01 deep winter — ice teal
  rgb("#7fd7c4"), // M02 late winter
  rgb("#6fe0a8"), // M03 thaw
  rgb("#5ef78a"), // M04 early spring — sprout
  rgb("#72e87c"), // M05 spring
  rgb("#63d98f"), // M06 late spring
  rgb("#58c9a0"), // M07 early summer
  rgb("#c98bab"), // M08 high summer — rose warmth
  rgb("#b795ff"), // M09 late summer — violet
  rgb("#b06a4e"), // M10 early autumn — copper
  rgb("#96543f"), // M11 autumn — russet
  rgb("#8a5f7a"), // M12 late autumn — mauve
  rgb("#6f6bb5"), // M13 year's end — indigo
];

/** Blend the four sky keyframes by beat: night ↔ dawn/dusk ↔ day. */
function skyStops(beat: number, season: RGB): [RGB, RGB, RGB] {
  const elev = Math.cos(((beat - 72) / BLOCKS_PER_DAY) * Math.PI * 2);
  const twilight = beat < 72 ? SKY.dawn : SKY.dusk;
  let stops: [RGB, RGB, RGB];
  if (elev <= -0.45) stops = SKY.night;
  else if (elev < 0.2) {
    const t = (elev + 0.45) / 0.65;
    stops = [0, 1, 2].map((i) => lerp3(SKY.night[i], twilight[i], t)) as [RGB, RGB, RGB];
  } else if (elev < 0.55) {
    const t = (elev - 0.2) / 0.35;
    stops = [0, 1, 2].map((i) => lerp3(twilight[i], SKY.day[i], t)) as [RGB, RGB, RGB];
  } else stops = SKY.day;
  return stops.map((c) => lerp3(c, season, 0.12)) as [RGB, RGB, RGB];
}

const GROUND_H = 44; // matches the device's original ground band

/**
 * Paint the full static garden for one block into `ctx` (W×H). Call ONCE per
 * block and cache the canvas — the rAF loop should only drawImage the result.
 */
export function drawBftBackground(
  ctx: CanvasRenderingContext2D, W: number, H: number, scene: BftScene,
): void {
  const season = SEASON[(scene.month - 1) % 13];
  const groundY = H - GROUND_H;

  // ── sky: beat-of-day light, seasonally tinted ──
  const stops = skyStops(scene.beat, season);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, css(stops[0]));
  sky.addColorStop(0.6, css(stops[1]));
  sky.addColorStop(1, css(stops[2]));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // ── moonlight: a fuller moon lifts the whole night ──
  const moonlight = 0.1 * scene.night * scene.moonIllum;
  if (moonlight > 0.005) {
    ctx.fillStyle = `rgba(214,240,224,${moonlight.toFixed(3)})`;
    ctx.fillRect(0, 0, W, groundY);
  }

  // ── the year-animal constellation — faint, night-only, stable all year ──
  if (scene.night > 0.05) {
    const crnd = prng(fnv(`bb:constellation:${scene.animalName}`));
    const pts = Array.from({ length: 6 }, () => ({
      x: W * 0.06 + crnd() * W * 0.52,
      y: 14 + crnd() * 78,
    })).sort((a, b) => a.x - b.x);
    ctx.strokeStyle = `rgba(94,247,138,${(0.1 * scene.night).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.fillStyle = `rgba(222,251,233,${(0.5 * scene.night).toFixed(3)})`;
    for (const p of pts) ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
  }

  // ── the moon — the SAME phase the footer names, arcing dusk→dawn ──
  if (scene.night > 0.03) {
    // night runs beat 108 (18:00) → 36 (06:00); progress 0→1 walks it east→west
    const np = clamp01((((scene.beat - 108 + BLOCKS_PER_DAY) % BLOCKS_PER_DAY) / 72));
    const mx = W * 0.86 - np * W * 0.62;
    const my = 64 - Math.sin(np * Math.PI) * 34;
    ctx.globalAlpha = clamp01(scene.night * 1.3);
    ctx.font = "26px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(scene.moonEmoji, mx, my);
    ctx.globalAlpha = 1;
  }

  // ── the sun — a soft warm-white disc (NOT gold), riding the day beats ──
  if (scene.daylight > 0.02) {
    const dp = clamp01((scene.beat - 36) / 72); // 06:00 → 18:00, east → west
    const sx = W * 0.14 + dp * W * 0.72;
    const sy = 66 - Math.sin(dp * Math.PI) * 38;
    const halo = ctx.createRadialGradient(sx, sy, 2, sx, sy, 30);
    halo.addColorStop(0, `rgba(241,239,231,${(0.55 * scene.daylight).toFixed(3)})`);
    halo.addColorStop(1, "rgba(241,239,231,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(sx - 30, sy - 30, 60, 60);
  }

  // ── hills reseed EVERY block — the garden shifts with the chain ──
  const rnd = prng(fnv(`bb:hills:${scene.height}`));
  const hillPts = Array.from({ length: 6 }, (_, i) => ({
    x: (W / 5) * i,
    y: groundY - 6 - rnd() * 20,
  }));
  ctx.fillStyle = css(lerp3(rgb("#0e1d15"), season, 0.1));
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(hillPts[0].x, hillPts[0].y);
  for (let i = 1; i < hillPts.length; i++) {
    const xc = (hillPts[i - 1].x + hillPts[i].x) / 2;
    const yc = (hillPts[i - 1].y + hillPts[i].y) / 2;
    ctx.quadraticCurveTo(hillPts[i - 1].x, hillPts[i - 1].y, xc, yc);
  }
  ctx.lineTo(W, groundY);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // ── ground + seeded grass ticks ──
  ctx.fillStyle = css(lerp3(rgb("#12281c"), season, 0.16));
  ctx.fillRect(0, groundY, W, GROUND_H);
  ctx.fillStyle = css(lerp3(rgb("#2f4a35"), season, 0.22));
  for (let i = 0; i < 9; i++) {
    const gx = 8 + rnd() * (W - 16);
    const gh = 4 + rnd() * 4;
    ctx.fillRect(gx, groundY - gh, 3, gh);
  }
}
