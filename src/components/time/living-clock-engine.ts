/**
 * THE LIVING CLOCK engine — the pupil study's square flip-clock, ported whole.
 *
 * Source of truth: studies/clock-study-pupil.html (rev 7, "Pac's lap law").
 * This file is the study's own JS adapted to the site: the DOM it drives is
 * rendered by LivingClock.tsx (same structure, `.lclk-*` scoped classes), the
 * BFT math comes from the house lib (@/lib/bb/bft — never re-derived), and the
 * network plumbing is REPLACED by update(): the ONE data seam is the fleet's
 * own /api/chain/tip door (owner ruling 0018.04.22 — our node first, mempool
 * next, pluggable server-side; this engine never fetches anything itself).
 *
 * The laws ported intact:
 *  - TEN LAPS PER BLOCK — Pac's lap counter IS the struggling digit; each
 *    lap's prize waits at 12 (the fruit ladder, cherry → key); the KEY is
 *    ninth because it unlocks the TENTH lap — the ₿ itself, eaten at the
 *    block-break BANG.
 *  - THE FIAT GHOSTS on the clock-hours 1–11 (world-currency faces): all
 *    frightened at the block boundary, eaten one-by-one on mouth-touch as
 *    Pac laps — behind Pac = eaten, ahead = frightened, at every moment.
 *  - THE STRAIN: only the live minute-ones digit trembles on its hinge,
 *    harder as the block ages; everything else is chain-exact and still.
 *  - THE 624 EMBER: the mempool dots breathe COLOUR (never motion) between
 *    brand-orange #F7931A and the 624 nm ember #FF6400; a found block flares.
 *  - Honest ~ everywhere an estimate rides; no fake pulses; nothing flashes
 *    more than 3×/sec (WCAG 2.3.1); prefers-reduced-motion → all steady.
 *
 * Omitted from the study (deliberate): the circle analog/moon clock, the
 * 🌍 my-sky tint, and the B/R/O/Z sim keys (workbench controls, not for the
 * face). The GHOSTY gif sprite was dead weight (hidden by CSS) — dropped.
 */

import { GENESIS_MS, bftDatePlain, bftTime } from "@/lib/bb/bft";

/** One reading through the seam — /api/chain/tip?full=1, relayed by TimeDoor. */
export interface LivingTip {
  height: number | null;
  /** true = the seam was dark and height is a genesis-anchored ~ guess */
  estimated: boolean;
  /** mempool vsize vs one block, 0..1 */
  fill: number;
  memCount: number | null;
  /** unix seconds the tip block was mined (chain fact), if the seam knew */
  tipTimestamp: number | null;
  diffChange: number | null;
  diffRemaining: number | null;
}

export interface LivingClockEngine {
  update(d: LivingTip): void;
  destroy(): void;
}

/* ═══ constants — ported verbatim from the study ═══ */
const pad = (n: number, w: number) => String(n).padStart(w, "0");
const beatOf = (h: number) => ((h % 144) + 144) % 144; // block-in-day, 0..143

/* ★ DAY 0 target — the NEW MOON that starts the new (BFT) calendar (study law):
   block 983,664 lands at BFT pulse 00:00 — bitcoin-midnight, 0018.10.28 a₿,
   ~7 Jan 2027 old-cal, around the day bitcoin turns 18. */
const GO_TARGET_HEIGHT = 983664;
const BLOCK_MS = 600000; // ~10 minutes per block

/* THE RING CLOCK GRID — 12 hour positions; the reward coin holds hour 12
   (path fraction 0, the top); the fiat ghosts take hours 1–11. */
const RING_SLOTS = 12;
const FIAT_SETS = [
  ["$", "€", "¥", "£", "₹", "₽", "₩", "₺", "₪", "₫", "₦"],
  ["€", "₹", "₽", "₩", "$", "£", "¥", "Fr", "kr", "zł", "₴"],
  ["£", "₩", "₺", "₪", "₫", "₦", "R$", "R", "$", "€", "¥"],
];
const GHOST_BMP = [
  "00011111000", "00111111100", "01111111110", "11111111111", "11111111111",
  "11111111111", "11111111111", "11111111111", "11111111111", "11111111111", "11011011011",
];
/* THE FRUIT LADDER — laps 1–9's prizes at 12 o'clock; the 10th is the ₿.
   TRUE classic arcade points ride the tooltips (cherry 100 → key 5000). */
const FRUITS = ["🍒", "🍓", "🍊", "🥨", "🍎", "🍈", "👾", "🔔", "🗝️"];
const FRUIT_NAMES = [
  "Cherry · 100", "Strawberry · 300", "Orange · 500", "Pretzel · 700",
  "Apple · 700", "Melon · 1000", "Galaxian · 2000", "Bell · 3000",
  "Key · 5000 — unlocks the tenth lap: the ₿",
];
const GEOM = { dotSize: 7, dotSpacing: 14, pacR: 9, fiatScale: 1.4 };
/* the 11 clock-hours 1–11 (hour 12 = fraction 0 = the coin) */
const FIAT_CARDINALS = Array.from({ length: RING_SLOTS - 1 }, (_, i) => (i + 1) / RING_SLOTS);
/* shared mouth-TOUCH lookahead (lap fraction) — a ghost is EATEN the instant
   Pac's mouth reaches it (the study's balanced value) */
const FIAT_EAT = 0.016;

/* ═══ THE STRAIN MAP — driven by REAL block age, never a fake easing curve ═══ */
function strainOf(ageSec: number) {
  const glow = Math.min(1, Math.pow(Math.max(0, ageSec) / 1500, 0.85));
  let amp = 0;
  if (ageSec > 300) amp = Math.min(0.25, ((ageSec - 300) / 300) * 0.25);
  if (ageSec > 600) amp = 0.25 + Math.min(1.35, Math.pow((ageSec - 600) / 240, 1.4) * 0.25);
  return { glow, amp };
}
const jit = (t: number, s: number) =>
  Math.sin(t * 13.7 + s * 5.1) * 0.6 + Math.sin(t * 7.3 + s * 9.2) * 0.3 + Math.sin(t * 29.1 + s * 2.7) * 0.1;

/* ═══ THE 624 EMBER — colour intensity only, never a wobble ═══ */
const EMBER_DIM = [247, 147, 26], EMBER_CORE = [255, 100, 0];
const lerp3 = (a: number[], b: number[], t: number) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
function emberAt(k: number) {
  const c = lerp3(EMBER_DIM, EMBER_CORE, Math.max(0, Math.min(1, k)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const SVGNS = "http://www.w3.org/2000/svg";
let clipSeq = 0; // unique clip-path ids across engine instances (strict-mode remounts)

interface Ghost {
  cardinal: number;
  el: SVGGElement;
  glyph: SVGTextElement;
  _glyph?: string;
  _st?: string;
}

export function createLivingClock(root: HTMLElement): LivingClockEngine {
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel);

  /* ═══ the DOM (rendered by LivingClock.tsx — same shape as the study) ═══ */
  const card = $<HTMLElement>(".lclk-card")!;
  const peri = $<SVGSVGElement>(".perimeter")!;
  const track = $<SVGPathElement>(".track")!;
  const seam = $<SVGLineElement>(".seam")!;
  const ringfx = $<SVGGElement>(".ringfx")!;
  const pixG = $<SVGGElement>(".pixlayer")!;
  const ghostG = $<SVGGElement>(".ghostlayer")!;
  const pill = $<SVGGElement>(".rewardcoin")!;
  const pacG = $<SVGGElement>(".pacman")!;
  const pacImg = $<SVGImageElement>(".pac-sprite")!;
  const colonEl = $<HTMLElement>(".bftclock .flip-colon")!;
  const noteEl = $<HTMLElement>(".note")!;
  const flipEls = Array.from(root.querySelectorAll<HTMLElement>(".bftclock .flip"));
  const valEls = flipEls.map((f) => f.querySelector<HTMLElement>(".flip-val")!);
  const onesFlip = $<HTMLElement>(".bftclock .flip.live")!;
  const onesVal = onesFlip.querySelector<HTMLElement>(".flip-val")!;

  /* ═══ state — the study's, minus its own fetch plumbing ═══ */
  const state = {
    height: null as number | null,
    est: true,
    lastWasLive: false,
    memFill: 0,
    memCount: null as number | null,
    lastBlockAt: null as number | null,
    diff: { change: null as number | null, remaining: null as number | null, live: false },
    correctingUntil: 0,
    netPulse: 0, // systole burst on block-break, decays over ~2s
  };

  /* ═══ THE PAC-RING — the one square ring (the study's factory, single instance) ═══ */
  interface Ring {
    path: SVGPathElement | null;
    L: number;
    disp: number;
    completing: boolean;
    N: number;
    blocks: (SVGRectElement | null)[];
    frontIndex: number;
    ghosts: Ghost[];
    coinShown: boolean;
    pacMouthDeg: number;
    pacClip: SVGPathElement | null;
    fruitFace: SVGTextElement | null;
    fruitPlate: SVGCircleElement | null;
    prizeLap: number | null;
    _pacSized?: boolean;
    _pacAt?: number | null;
    _pacL?: number;
    _pulseT?: number;
    _ct?: ReturnType<typeof setTimeout>;
    _prizeT?: ReturnType<typeof setTimeout>;
  }
  const R: Ring = {
    path: null, L: 0, disp: 0, completing: false,
    N: 0, blocks: [], frontIndex: -1, ghosts: [], coinShown: false,
    pacMouthDeg: 30, pacClip: null, fruitFace: null, fruitPlate: null, prizeLap: null,
  };

  /* THE CHOMP CLIP — a Pac-shaped clipPath (disc minus an animated mouth wedge)
     masks the static tricolor sprite; only the wedge angle changes per frame. */
  {
    let defs = peri.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS(SVGNS, "defs");
      peri.insertBefore(defs, peri.firstChild);
    }
    while (defs.firstChild) defs.removeChild(defs.firstChild); // idempotent re-create (strict-mode remount)
    const cpId = `lclk-mouthclip-${++clipSeq}`;
    const cp = document.createElementNS(SVGNS, "clipPath");
    cp.setAttribute("id", cpId);
    cp.setAttribute("clipPathUnits", "userSpaceOnUse");
    R.pacClip = document.createElementNS(SVGNS, "path");
    cp.appendChild(R.pacClip);
    defs.appendChild(cp);
    pacImg.setAttribute("clip-path", `url(#${cpId})`);
  }

  /* ═══ THE EAT-DRIVEN GHOST LOOP — the shared cycle (one ring here, same laws) ═══ */
  const fiatCycle = {
    states: FIAT_CARDINALS.map(() => "blue") as string[], // 'blue' frightened+eatable (AHEAD of Pac) | 'eaten' gone (BEHIND Pac)
    cur: FIAT_CARDINALS.map((_, i) => FIAT_SETS[0][i]),
    idx: 0,
    lastFrac: null as number | null,
    rotatedFor: null as number | null,
    coinBack: true, // the ₿ at 12 — Pac's destination each block
  };
  function fiatCycleBreak() {
    // BLOCK BOUNDARY — all frightened again, the ₿ back at 12, the monies rotate (once per block)
    if (fiatCycle.rotatedFor !== state.height) {
      fiatCycle.idx = (fiatCycle.idx + 1) % FIAT_SETS.length;
      fiatCycle.rotatedFor = state.height;
    }
    const set = FIAT_SETS[fiatCycle.idx];
    for (let i = 0; i < fiatCycle.states.length; i++) {
      fiatCycle.cur[i] = set[i];
      fiatCycle.states[i] = "blue";
    }
    fiatCycle.coinBack = true;
  }
  function stepFiatCycle(pacFrac: number, completing: boolean) {
    /* SILENT estimate-mode rollover: a wrap with no powerUp is treated as a BANG */
    if (fiatCycle.lastFrac != null && pacFrac < fiatCycle.lastFrac - 0.4) fiatCycleBreak();
    fiatCycle.lastFrac = pacFrac;
    if (!completing)
      for (let i = 0; i < FIAT_CARDINALS.length; i++)
        if (fiatCycle.states[i] === "blue" && pacFrac + FIAT_EAT >= FIAT_CARDINALS[i])
          fiatCycle.states[i] = "eaten"; // GONE the instant Pac's mouth reaches it
  }

  /* an 8-bit pixel ghost — GLYPH tricolor treatment: three phase-offset
     silhouette layers (colour + shimmer live in CSS); the currency is the face */
  function buildPixelGhost(): SVGGElement {
    const g = document.createElementNS(SVGNS, "g");
    g.setAttribute("class", "g-pixel");
    const LAYERS: [string, number, number][] = [
      ["g-layer g-layer-lime", -0.7, -0.5],
      ["g-layer g-layer-core", 0.0, 0.0],
      ["g-layer g-layer-deep", 0.7, 0.5],
    ];
    for (const [cls, dx, dy] of LAYERS) {
      const layer = document.createElementNS(SVGNS, "g");
      layer.setAttribute("class", cls);
      layer.setAttribute("transform", `translate(${dx} ${dy})`);
      for (let r = 0; r < GHOST_BMP.length; r++)
        for (let c = 0; c < 11; c++) {
          if (GHOST_BMP[r][c] !== "1") continue;
          const px = document.createElementNS(SVGNS, "rect");
          px.setAttribute("x", (c - 5.5).toFixed(2));
          px.setAttribute("y", (r - 5.5).toFixed(2));
          px.setAttribute("width", "1");
          px.setAttribute("height", "1");
          px.setAttribute("class", "g-body");
          layer.appendChild(px);
        }
      g.appendChild(layer);
    }
    return g;
  }

  function buildFiatGhosts() {
    while (ghostG.firstChild) ghostG.removeChild(ghostG.firstChild);
    R.ghosts = [];
    for (let i = 0; i < FIAT_CARDINALS.length; i++) {
      const el = document.createElementNS(SVGNS, "g") as SVGGElement;
      el.setAttribute("class", "ghost");
      const pixel = buildPixelGhost();
      const glyph = document.createElementNS(SVGNS, "text") as SVGTextElement;
      glyph.setAttribute("class", "g-glyph");
      glyph.setAttribute("x", "0");
      glyph.setAttribute("y", "-0.4");
      glyph.textContent = fiatCycle.cur[i];
      const inner = document.createElementNS(SVGNS, "g");
      inner.setAttribute("class", "g-inner"); // the life layer — blink rides here
      inner.appendChild(pixel);
      inner.appendChild(glyph); // glyph LAST → always on top
      el.appendChild(inner);
      applyGhostState(el, fiatCycle.states[i]); // no 1-frame stale flash
      ghostG.appendChild(el);
      R.ghosts.push({ cardinal: FIAT_CARDINALS[i], el, glyph });
    }
  }
  function positionFiatGhosts() {
    if (!R.path || !R.L) return;
    for (const gh of R.ghosts) {
      const pt = R.path.getPointAtLength(gh.cardinal * R.L);
      gh.el.setAttribute("transform", `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) scale(${GEOM.fiatScale})`);
    }
  }
  function applyGhostState(el: SVGGElement, st: string) {
    el.classList.toggle("frightened", st === "blue");
    el.classList.toggle("eaten", st === "eaten"); // CSS stops an eaten ghost's animations
    el.style.opacity = st === "eaten" ? "0" : "1"; // eaten = GONE
  }
  function renderFiat() {
    // paint the cycle — but ONLY touch the DOM when a ghost actually CHANGED
    for (let i = 0; i < R.ghosts.length; i++) {
      const gh = R.ghosts[i], st = fiatCycle.states[i], glyph = fiatCycle.cur[i];
      if (gh._glyph !== glyph) { gh.glyph.textContent = glyph; gh._glyph = glyph; }
      if (gh._st !== st) { applyGhostState(gh.el, st); gh._st = st; }
    }
  }

  /* ═══ THE REWARD at 12 — the ₿ coin, and the fruit ladder before it ═══ */
  function hideCoin() {
    R.coinShown = false;
    if (REDUCED) { pill.style.opacity = "0"; return; }
    pill.classList.remove("appear", "eaten");
    void pill.getBBox();
    pill.classList.add("eaten");
    clearTimeout(R._ct);
    R._ct = setTimeout(() => { pill.style.opacity = "0"; pill.classList.remove("eaten"); }, 380);
  }
  function showCoin() {
    R.coinShown = true;
    pill.style.opacity = "1";
    if (REDUCED) return;
    pill.classList.remove("eaten", "appear");
    void pill.getBBox();
    pill.classList.add("appear");
    clearTimeout(R._ct);
    R._ct = setTimeout(() => pill.classList.remove("appear"), 520);
  }
  function flashBang() {
    // "HACK THE PLANET" — the block-break easter-egg flash (one fade, WCAG-safe)
    const b = $<HTMLElement>(".bang");
    if (!b) return;
    b.classList.remove("flash");
    void b.offsetWidth;
    b.classList.add("flash");
  }

  function ensureFruitFace() {
    const inner = pill.querySelector(".coin-inner");
    if (!inner) return;
    if (!R.fruitPlate) {
      const existing = inner.querySelector<SVGCircleElement>(".fruit-plate");
      if (existing) R.fruitPlate = existing;
      else {
        // the PLATE — a dark backing disc so the origin seam never pokes out under the fruit
        const plate = document.createElementNS(SVGNS, "circle") as SVGCircleElement;
        plate.setAttribute("class", "fruit-plate");
        plate.setAttribute("r", "15");
        plate.style.display = "none";
        inner.appendChild(plate);
        R.fruitPlate = plate;
      }
    }
    if (!R.fruitFace) {
      const existing = inner.querySelector<SVGTextElement>(".fruit-face");
      if (existing) R.fruitFace = existing;
      else {
        // the FRUIT — big, alive, bobbing (reduced motion stills it)
        const t = document.createElementNS(SVGNS, "text") as SVGTextElement;
        t.setAttribute("class", "fruit-face");
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("dominant-baseline", "central");
        t.style.font = "24px ui-monospace, Consolas, monospace";
        t.style.display = "none";
        inner.appendChild(t);
        R.fruitFace = t;
      }
    }
  }
  function setPrize(lap: number) {
    ensureFruitFace();
    R.prizeLap = lap;
    const isCoin = lap >= 9; // the tenth lap: the ₿ itself
    const inner = pill.querySelector(".coin-inner");
    const back = inner?.querySelector<SVGCircleElement>(".coin-back");
    const img = inner?.querySelector<SVGImageElement>(".coin-img");
    if (back) back.style.display = isCoin ? "" : "none";
    if (img) img.style.display = isCoin ? "" : "none";
    if (R.fruitPlate) R.fruitPlate.style.display = isCoin ? "none" : "";
    if (R.fruitFace) {
      R.fruitFace.style.display = isCoin ? "none" : "";
      if (!isCoin) R.fruitFace.textContent = FRUITS[lap];
    }
    pill.classList.toggle("fruitlap", !isCoin); // reduced-motion: the ₿ fallback yields to the fruit
    const label = isCoin ? "the block reward — the ₿ waits on the tenth lap" : FRUIT_NAMES[lap];
    pill.setAttribute("aria-label", label);
    const title =
      pill.querySelector("title") ??
      pill.insertBefore(document.createElementNS(SVGNS, "title"), pill.firstChild);
    title.textContent = label;
  }
  function advancePrize(lap: number) {
    if (R.prizeLap == null) { setPrize(lap); return; } // first paint (seed/boot)
    if (R.prizeLap === lap) return;
    const wrapped = lap < R.prizeLap; // block break — the BANG/powerUp path owns the ₿ eat
    if (wrapped || REDUCED) { setPrize(lap); return; }
    // Pac just crossed 12: pop the eaten fruit, then reveal the next rung
    pill.classList.remove("appear", "eaten");
    void pill.getBBox();
    pill.classList.add("eaten");
    const next = lap;
    clearTimeout(R._prizeT);
    R._prizeT = setTimeout(() => {
      pill.classList.remove("eaten");
      setPrize(next);
      pill.classList.add("appear");
      setTimeout(() => pill.classList.remove("appear"), 520);
    }, 380);
    R.prizeLap = lap; // recorded now so a slow timeout can't double-fire
  }

  /* THE BANG — the block breaks: Pac eats the ₿ at 12 (whatever rung was up,
     an early break lands mid-ladder — the BANG is ALWAYS the ₿, never a fruit),
     then the ladder resets to the cherry for the new block's first lap. */
  function powerUp() {
    fiatCycleBreak(); // the new block's power → the whole fiat board resets frightened
    flashBang(); // "HACK THE PLANET"
    if (!REDUCED) {
      pacG.classList.remove("powerup");
      void pacG.getBBox();
      pacG.classList.add("powerup");
    }
    if (REDUCED) {
      setPrize(0); // steady swap — no eat pop under reduced motion
    } else {
      setPrize(9); // the ₿ face for the eat
      pill.classList.remove("appear", "eaten");
      void pill.getBBox();
      pill.classList.add("eaten"); // flash + vanish — the ₿ is consumed
      R.prizeLap = 0; // the loop's advancePrize(0) must not double-fire
      clearTimeout(R._prizeT);
      R._prizeT = setTimeout(() => {
        pill.classList.remove("eaten");
        setPrize(0); // the cherry — lap one of the new block
        pill.classList.add("appear");
        setTimeout(() => pill.classList.remove("appear"), 520);
      }, 380);
    }
    updateLiveDigit(); // snap the LIVE ones digit exactly at the BANG
  }

  /* ═══ ring geometry — the square rounded-rect track, origin at 12 ═══ */
  function rebuildRing() {
    const w = card.offsetWidth, h = card.offsetHeight;
    if (!w || !h) return;
    const i = 11, r = 9; // 11px inset seats the scaled ghosts fully inside; i+r=20 = the card's radius
    const d =
      `M ${w / 2} ${i} L ${w - i - r} ${i} A ${r} ${r} 0 0 1 ${w - i} ${i + r}` +
      ` L ${w - i} ${h - i - r} A ${r} ${r} 0 0 1 ${w - i - r} ${h - i}` +
      ` L ${i + r} ${h - i} A ${r} ${r} 0 0 1 ${i} ${h - i - r}` +
      ` L ${i} ${i + r} A ${r} ${r} 0 0 1 ${i + r} ${i} Z`;
    peri.setAttribute("width", String(w));
    peri.setAttribute("height", String(h));
    peri.setAttribute("viewBox", `0 0 ${w} ${h}`);
    track.setAttribute("d", d);
    seam.setAttribute("x1", String(w / 2));
    seam.setAttribute("x2", String(w / 2));
    seam.setAttribute("y1", String(i + 2));
    seam.setAttribute("y2", String(i + 10));
    R.path = track;
    R.L = track.getTotalLength();
    buildPixels();
    const p0 = R.path.getPointAtLength(0); // pin the reward to the origin (12 o'clock)
    pill.setAttribute("transform", `translate(${p0.x.toFixed(2)} ${p0.y.toFixed(2)})`);
    R.coinShown = fiatCycle.coinBack; // resize-safe — the cycle decides
    pill.style.opacity = R.coinShown ? "1" : "0";
    positionFiatGhosts();
    renderFiat(); // a resize/rebuild never shows a stale or reset ring
    renderRing(R.disp);
  }

  /* the mempool pixel-squares, truly equidistant; pellets flanking each
     clock-hour (the coin + every ghost) are suppressed — classic maze spacing */
  function buildPixels() {
    const L = R.L;
    if (!L) return;
    while (pixG.firstChild) pixG.removeChild(pixG.firstChild);
    const N = Math.max(24, RING_SLOTS * Math.round(L / GEOM.dotSpacing / RING_SLOTS));
    R.N = N;
    R.blocks = [];
    R.frontIndex = -1;
    const bin = 1 / N;
    const guards = [{ f: 0, pad: 1.05 * bin }];
    for (const gh of R.ghosts) guards.push({ f: gh.cardinal, pad: 1.05 * bin });
    for (let i = 0; i < N; i++) {
      const f = (i + 0.5) / N;
      let skip = false;
      for (const c of guards) {
        let d = Math.abs(f - c.f);
        d = Math.min(d, 1 - d);
        if (d < c.pad) { skip = true; break; }
      }
      if (skip) { R.blocks.push(null); continue; } // keep index → fraction alignment
      const pt = R.path!.getPointAtLength(f * L);
      const rect = document.createElementNS(SVGNS, "rect") as SVGRectElement;
      rect.setAttribute("x", (pt.x - GEOM.dotSize / 2).toFixed(1));
      rect.setAttribute("y", (pt.y - GEOM.dotSize / 2).toFixed(1));
      rect.setAttribute("width", String(GEOM.dotSize));
      rect.setAttribute("height", String(GEOM.dotSize));
      rect.setAttribute("rx", "1");
      rect.setAttribute("class", "pix");
      rect.style.opacity = "0.09";
      pixG.appendChild(rect);
      R.blocks.push(rect);
    }
  }

  /* place PAC — the real tricolor sprite — at ring-fraction `frac`, facing
     travel. Pac never pulses; ONLY the mouth wedge animates (the chomp). */
  function drawPac(frac: number, halfDeg: number) {
    const L = R.L;
    if (!L || !R.path) return;
    const w = GEOM.pacR * 2.9; // sprite size ≈ Pac diameter (CONSTANT)
    if (!R._pacSized) {
      pacImg.setAttribute("width", w.toFixed(1));
      pacImg.setAttribute("height", w.toFixed(1));
      pacImg.setAttribute("x", (-w / 2).toFixed(1));
      pacImg.setAttribute("y", (-w / 2).toFixed(1));
      R._pacSized = true;
    }
    const at = ((frac * L) % L + L) % L;
    /* recompute position/orientation only when Pac visibly MOVED (block-pace ≈ 0.05u/frame) */
    if (R._pacAt == null || R._pacL !== L || Math.abs(at - R._pacAt) > 0.15) {
      R._pacAt = at;
      R._pacL = L;
      const P = R.path.getPointAtLength(at);
      const P2 = R.path.getPointAtLength((at + Math.max(1, L * 0.002)) % L);
      const deg = (Math.atan2(P2.y - P.y, P2.x - P.x) * 180) / Math.PI;
      pacImg.setAttribute("transform", `translate(${P.x.toFixed(2)} ${P.y.toFixed(2)}) rotate(${deg.toFixed(1)})`);
    }
    /* THE CHOMP — reshape the mouth wedge every frame */
    if (R.pacClip) {
      const m = (Math.max(2, halfDeg) * Math.PI) / 180;
      const r0 = w * 0.55;
      const x1 = (r0 * Math.cos(m)).toFixed(2);
      const y1 = (r0 * Math.sin(m)).toFixed(2);
      const y2 = (-r0 * Math.sin(m)).toFixed(2);
      R.pacClip.setAttribute("d", `M 0 0 L ${x1} ${y1} A ${r0.toFixed(2)} ${r0.toFixed(2)} 0 1 1 ${x1} ${y2} Z`);
    }
  }

  /* light the dots, place Pac: behind Pac = eaten (gone), ahead = waiting */
  function renderRing(pacFrac: number) {
    const L = R.L, N = R.N;
    if (!L || !N) return;
    const bright = (state.est ? 0.6 : 1).toFixed(3);
    const eatenEdge = pacFrac + (GEOM.pacR * 0.5) / L;
    let fi = -1;
    for (let i = 0; i < N; i++) {
      const b = R.blocks[i];
      if (!b) continue;
      const f = (i + 0.5) / N;
      const op = f < eatenEdge ? "0" : bright;
      const bb = b as SVGRectElement & { __op?: string };
      if (bb.__op !== op) { bb.style.opacity = op; bb.__op = op; }
      if (fi < 0 && f >= pacFrac) fi = i; // the next pellet Pac will eat
    }
    if (fi !== R.frontIndex) {
      if (R.frontIndex >= 0 && R.blocks[R.frontIndex]) R.blocks[R.frontIndex]!.classList.remove("front");
      if (fi >= 0 && R.blocks[fi]) R.blocks[fi]!.classList.add("front");
      R.frontIndex = fi;
    }
    drawPac(pacFrac, R.pacMouthDeg);
  }

  function updateRingCycle(pacFrac: number) {
    stepFiatCycle(pacFrac, R.completing);
    if (fiatCycle.coinBack) { if (!R.coinShown) showCoin(); }
    else if (R.coinShown) hideCoin();
    renderFiat();
  }

  /* the ember breath — mempool pressure in COLOUR; a found block FLARES */
  function applyNetworkPulse(nowMs: number) {
    if (ringfx.style.transform !== "none") { ringfx.style.transform = "none"; ringfx.style.filter = "none"; }
    if (REDUCED) { pixG.style.filter = `drop-shadow(0 0 5.5px ${emberAt(0.5)}) brightness(1.2)`; return; }
    if (nowMs - (R._pulseT || 0) < 100) return; // ~10 fps colour breath
    R._pulseT = nowMs;
    const pressure = state.est ? 0.35 : state.memFill;
    const breath = 0.5 - 0.5 * Math.cos((2 * Math.PI * nowMs) / 2000); // one calm breath / 2 s
    const rest = 0.14 + pressure * 0.34;
    const swing = 0.14 + pressure * 0.34;
    const base = Math.max(0, Math.min(1, rest + breath * swing));
    const neon = Math.max(0, Math.min(1, state.netPulse));
    const glowPx = (2 + base * 6 + neon * 13).toFixed(1);
    const bright = (1 + base * 0.4 + neon * 0.6).toFixed(3);
    const sat = (1 + neon * 0.7).toFixed(2);
    pixG.style.filter = `drop-shadow(0 0 ${glowPx}px ${emberAt(Math.max(base, neon))}) brightness(${bright}) saturate(${sat})`;
  }

  /* ═══ the strain — only the live ones digit trembles ═══ */
  function blockAgeSec() {
    return state.lastBlockAt ? (Date.now() - state.lastBlockAt) / 1000 : 0;
  }
  function applyStrain(nowMs: number) {
    const t = nowMs / 1000;
    const age = blockAgeSec();
    const { glow, amp } = strainOf(age);
    const correcting = Date.now() < state.correctingUntil;
    if (!REDUCED) onesVal.style.transform = `rotateX(${(amp * 9 * jit(t, 3.1)).toFixed(2)}deg)`;
    else onesVal.style.transform = "none";
    colonEl.style.opacity = "0.92"; // the colon holds steady
    if (correcting) {
      /* the honest correction — a STEADY red-shifted hold, never a flicker
         (WCAG 2.3.1: nothing on this clock flashes more than 3×/sec) */
      valEls.forEach((el) => { el.style.color = "#ff5b47"; });
      onesFlip.style.boxShadow = "";
    } else {
      valEls.forEach((el) => { el.style.color = ""; });
      onesFlip.style.boxShadow =
        glow > 0.05
          ? `0 0 ${(5 + 18 * glow).toFixed(0)}px rgba(247,147,26,${(0.12 + 0.35 * glow).toFixed(2)})`
          : "";
    }
  }

  /* ═══ the flip digits ═══ */
  function flipTo(i: number, v: string) {
    const valEl = valEls[i], flipEl = flipEls[i] as HTMLElement & { _ft?: ReturnType<typeof setTimeout> };
    if (!valEl || valEl.textContent === v) return;
    valEl.textContent = v;
    flipEl.classList.remove("flipping");
    void flipEl.offsetWidth;
    flipEl.classList.add("flipping");
    clearTimeout(flipEl._ft);
    flipEl._ft = setTimeout(() => flipEl.classList.remove("flipping"), 600);
  }
  /* THE LIVE DIGIT — minute-ONES = progress through THIS block in tenths,
     the SAME block-age that drives Pac's lap and the ring fill */
  function updateLiveDigit() {
    if (state.height == null) return;
    const prog = Math.min(0.999, Math.max(0, blockAgeSec() / 600));
    flipTo(3, String(Math.min(9, Math.floor(prog * 10))));
    const pctEl = $<HTMLElement>(".blockpct");
    if (pctEl)
      pctEl.innerHTML = `~<b>${Math.round(prog * 100)}%</b> of the way to the <span class="nb">next&nbsp;block</span>`;
  }

  function renderNumbers() {
    if (state.height == null) return;
    const [hh, mm] = bftTime(state.height).split(":"); // tens = block-in-hour; ones (live) is replaced below
    flipTo(0, hh[0]);
    flipTo(1, hh[1]);
    flipTo(2, mm[0]);
    updateLiveDigit();
    const dateEl = $<HTMLElement>(".bftdate");
    if (dateEl) dateEl.textContent = bftDatePlain(state.height);
    // the old-calendar conversion — the tip block is "now"
    const oc = $<HTMLElement>(".oldcal");
    if (oc) {
      const d = new Date();
      oc.textContent = `old cal · ${d
        .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
        .toUpperCase()}`;
    }
    /* the block height + beat ride the dateline's TOOLTIP (owner ruling
       0018.04.22: face = time + date only; height lives in tooltips and
       in the experiment strip) */
    const dl = $<HTMLElement>(".dateline");
    if (dl)
      dl.title = `★${state.est ? "~" : ""}${state.height.toLocaleString("en-US")} · beat ${String(
        beatOf(state.height)
      ).padStart(3, "0")}/144 — the block height behind this date`;
    renderLevel();
    renderGoTimer();
  }

  /* the arcade LEVEL = difficulty epoch */
  function renderLevel() {
    if (state.height == null) return;
    const epoch = Math.floor(state.height / 2016);
    const est = state.est || !state.diff.live;
    const ch = state.diff.change;
    let arrow = "";
    if (!est && ch != null) {
      if (ch > 0.05) arrow = ` <span class="up">▲</span>`;
      else if (ch < -0.05) arrow = ` <span class="down">▼</span>`;
    }
    const lvl = $<HTMLElement>(".levelbadge");
    if (lvl) lvl.innerHTML = `${est ? "~" : ""}LEVEL ${epoch}${arrow}`;
  }

  function renderStatus() {
    const src = $<HTMLElement>(".src");
    if (src) {
      if (state.est) { src.textContent = "~ EST"; src.className = "src est"; }
      else { src.textContent = "LIVE"; src.className = "src live"; }
    }
    const mem = $<HTMLElement>(".memline");
    if (mem) {
      if (state.est) mem.textContent = "~ payments waiting · new block ~10 min";
      else if (state.memCount != null) {
        const full = state.memFill >= 1 ? "is full" : `~${Math.round(state.memFill * 100)}% full`;
        mem.textContent = `${state.memCount.toLocaleString("en-US")} payments waiting · next block ${full}`;
      } else mem.textContent = "payments —";
    }
    peri.classList.toggle("est", state.est);
  }

  let noteTimer: ReturnType<typeof setTimeout> | undefined;
  function flashNote(txt: string) {
    noteEl.textContent = ` · ${txt}`;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { noteEl.textContent = ""; }, 10000);
  }

  /* ═══ THE DAY-0 COUNTDOWN (the flip-card back) ═══ */
  let goTargetMs: number | null = null;
  let goBlocksAnchor: number | null = null;
  let d0Fired = false;
  function cdSet(cls: string, ch: string) {
    const val = $<HTMLElement>("." + cls);
    if (!val || val.textContent === ch) return;
    val.textContent = ch;
    const f = val.parentElement as HTMLElement & { _ft?: ReturnType<typeof setTimeout> };
    f.classList.remove("flipping");
    void f.offsetWidth;
    f.classList.add("flipping");
    clearTimeout(f._ft);
    f._ft = setTimeout(() => f.classList.remove("flipping"), 600);
  }
  function renderGoTimer() {
    if (state.height == null) return;
    const raw = GO_TARGET_HEIGHT - state.height;
    const toGo = Math.max(0, raw);
    const reached = raw <= 0;
    const tilde = state.est ? "~" : "";
    // re-anchor only when blocks-to-go changes so the seconds run smoothly
    if (goBlocksAnchor !== toGo) {
      goBlocksAnchor = toGo;
      goTargetMs = Date.now() + toGo * BLOCK_MS;
    }
    const d0 = $<HTMLElement>(".d0-timer");
    if (d0) {
      d0.classList.toggle("reached", reached);
      const tg = d0.querySelector<HTMLElement>(".d0-togo");
      if (tg) tg.textContent = reached ? "0" : `${tilde}${toGo.toLocaleString("en-US")}`;
    }
    if (reached && !d0Fired) fireDayZero();
    if (!reached && d0Fired) resetDayZero();
    tickGoTimer(); // paint the flip digits immediately
  }
  function tickGoTimer() {
    if (goTargetMs == null) return;
    const d0 = $<HTMLElement>(".d0-timer");
    if (!d0 || d0.classList.contains("reached")) return;
    const totalSec = Math.floor(Math.max(0, goTargetMs - Date.now()) / 1000);
    const dd = pad(Math.min(999, Math.floor(totalSec / 86400)), 3);
    const hh = pad(Math.floor((totalSec % 86400) / 3600), 2);
    const mm = pad(Math.floor((totalSec % 3600) / 60), 2);
    const ss = pad(totalSec % 60, 2);
    cdSet("cd-d0", dd[0]); cdSet("cd-d1", dd[1]); cdSet("cd-d2", dd[2]);
    cdSet("cd-h0", hh[0]); cdSet("cd-h1", hh[1]);
    cdSet("cd-m0", mm[0]); cdSet("cd-m1", mm[1]);
    cdSet("cd-s0", ss[0]); cdSet("cd-s1", ss[1]);
  }
  /* DAY 0 — balloons float up + the Day-0 surprise (fires ONCE at zero) */
  function fireDayZero() {
    d0Fired = true;
    if (REDUCED) return; // static cheer carries the payoff
    const big = $<HTMLElement>(".d0-cheer-big");
    if (big) { big.classList.remove("flash"); void big.offsetWidth; big.classList.add("flash"); }
    const b = $<HTMLElement>(".balloons");
    if (b) spawnBalloons(b);
  }
  function resetDayZero() {
    d0Fired = false;
    const b = $<HTMLElement>(".balloons");
    if (b) b.innerHTML = "";
    const big = $<HTMLElement>(".d0-cheer-big");
    if (big) big.classList.remove("flash");
  }
  function spawnBalloons(container: HTMLElement) {
    container.innerHTML = "";
    const rise = container.offsetHeight + 90;
    const COLORS = ["#F7931A", "#FF6400", "#f3b40c", "#ffd9a0", "#e8916a"];
    for (let i = 0; i < 20; i++) {
      const b = document.createElement("div");
      b.className = "balloon";
      const size = 15 + Math.random() * 16;
      b.style.left = Math.random() * 90 + 3 + "%";
      b.style.width = size + "px";
      b.style.height = size * 1.25 + "px";
      b.style.background = COLORS[i % COLORS.length];
      b.style.setProperty("--rise", rise + "px");
      b.style.setProperty("--drift", Math.random() * 40 - 20 + "px");
      b.style.animation = `lclk-floatUp ${(3.4 + Math.random() * 2.6).toFixed(2)}s linear ${(Math.random() * 2.2).toFixed(2)}s infinite`;
      container.appendChild(b);
    }
  }

  /* ═══ block events ═══ */
  let sysTimer: ReturnType<typeof setTimeout> | undefined;
  function blockSystole() {
    card.classList.add("blockpulse");
    clearTimeout(sysTimer);
    sysTimer = setTimeout(() => card.classList.remove("blockpulse"), 1300);
  }
  function onBlockBreak(h: number) {
    const delta = h - (state.height ?? h - 1);
    state.height = h;
    state.est = false;
    state.lastBlockAt = Date.now();
    renderNumbers(); // tens +10 (canonical BFT beat), ones → 0
    powerUp(); // THE BANG — Pac eats the ₿ at 12; the fiat board resets frightened
    state.netPulse = 1; // the vibrant neon flare, decays ~2 s
    blockSystole();
    if (delta > 1) flashNote(`+${delta} blocks`);
  }
  function onCorrection(h: number) {
    const d = (state.height ?? h) - h;
    state.height = h;
    state.correctingUntil = Date.now() + 8000; // shown, never silently snapped
    renderNumbers();
    flashNote(`corrected −${d}`);
  }
  /* offline / cold-boot: the site's genesis-anchored honest ~ (house law —
     "counting ~10 min a block from genesis"), never pulsed, never celebrated */
  function applyEstimate() {
    const now = Date.now();
    const est = Math.max(0, Math.floor((now - GENESIS_MS) / BLOCK_MS));
    state.est = true;
    state.lastWasLive = false;
    state.height = est;
    state.lastBlockAt = GENESIS_MS + est * BLOCK_MS;
    renderNumbers();
    renderStatus();
  }

  /* ═══ the animation loop — TEN LAPS PER BLOCK ═══ */
  function lapOf(blockProg: number) {
    const lap = Math.min(9, Math.floor(blockProg * 10));
    return { lap, lapFrac: Math.min(0.999, blockProg * 10 - lap) };
  }
  let lastT = performance.now();
  let rafId = 0;
  let destroyed = false;
  function stepRing(now: number, lapFrac: number, lap: number) {
    const chomp = 0.5 - 0.5 * Math.cos((now / 1000) * Math.PI * 2 * 2.6); // ~2.6 Hz arcade chomp
    R.pacMouthDeg = 8 + 48 * chomp;
    advancePrize(lap);
    R.disp = lapFrac;
    renderRing(R.disp);
    updateRingCycle(R.disp);
    applyNetworkPulse(now);
  }
  function frame(now: number) {
    if (destroyed) return;
    const dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    state.netPulse = Math.max(0, state.netPulse - dt / 2.0);
    const { lap, lapFrac } = lapOf(Math.min(0.999, blockAgeSec() / 600));
    stepRing(now, lapFrac, lap);
    updateLiveDigit();
    applyStrain(now);
    rafId = requestAnimationFrame(frame);
  }
  function reducedTick() {
    const now = performance.now();
    const { lap, lapFrac } = lapOf(Math.min(0.999, blockAgeSec() / 600));
    R.pacMouthDeg = 34; // the mouth holds a calm half-open — no chomp motion
    advancePrize(lap);
    R.disp = lapFrac;
    renderRing(R.disp);
    updateRingCycle(R.disp);
    applyNetworkPulse(now);
    updateLiveDigit();
    applyStrain(now);
  }

  /* ═══ INITIAL-LOAD SEED — the honest snapshot from frame 1: Pac AT block-%,
     swept ghosts eaten, the ₿ at 12 — no free sweep, ever ═══ */
  function seedInitialState() {
    const { lap, lapFrac } = lapOf(Math.min(0.999, blockAgeSec() / 600));
    const p = lapFrac;
    for (let i = 0; i < FIAT_CARDINALS.length; i++)
      fiatCycle.states[i] = p + FIAT_EAT >= FIAT_CARDINALS[i] ? "eaten" : "blue";
    fiatCycle.coinBack = true;
    fiatCycle.lastFrac = p;
    fiatCycle.idx = 0;
    R.disp = p;
    R.completing = false;
    setPrize(lap);
    R.coinShown = true;
    pill.style.opacity = "1";
    renderFiat();
    if (R.L) renderRing(R.disp);
  }

  /* re-seed the board from the CURRENT honest block progress — behind Pac =
     eaten, ahead = frightened, at every moment. Used whenever the block age
     jumps for an honest reason (first live reading, a reorg correction) so
     the ghosts can never sit stale against Pac's real position. */
  function reseedGhosts() {
    const { lap, lapFrac } = lapOf(Math.min(0.999, blockAgeSec() / 600));
    for (let i = 0; i < FIAT_CARDINALS.length; i++)
      fiatCycle.states[i] = lapFrac + FIAT_EAT >= FIAT_CARDINALS[i] ? "eaten" : "blue";
    fiatCycle.lastFrac = lapFrac;
    setPrize(lap);
    renderFiat();
  }

  /* ═══ the seam in — TimeDoor relays /api/chain/tip?full=1 readings here ═══ */
  function update(d: LivingTip) {
    state.memFill = Math.max(0, Math.min(1, d.fill));
    state.memCount = d.memCount;
    state.diff = { change: d.diffChange, remaining: d.diffRemaining, live: d.diffChange != null };
    if (d.height == null || d.estimated) {
      // the seam is dark — the honest ~ carries (the 1 s estimate interval keeps it counting)
      applyEstimate();
      return;
    }
    const prev = state.height, wasLive = state.lastWasLive;
    let seed = false;
    if (prev == null || !wasLive) {
      state.height = d.height;
      state.est = false;
      state.lastBlockAt = Date.now();
      seed = true; // the honest age lands just below — re-seed the board to it
    } else if (d.height > prev) {
      onBlockBreak(d.height);
    } else if (d.height < prev) {
      onCorrection(d.height);
      seed = true; // a reorg shifted the age — re-seed
    }
    /* refine the block age from the chain's own stamp (the study's
       fetchTipTime, now riding the same seam response; miner-skew clamped) */
    if (d.tipTimestamp != null) state.lastBlockAt = Math.min(d.tipTimestamp * 1000, Date.now());
    if (seed) reseedGhosts();
    state.est = false;
    state.lastWasLive = true;
    renderNumbers();
    renderStatus();
  }

  /* ═══ boot — the study's, minus its own fetches ═══ */
  buildFiatGhosts();
  const ro = new ResizeObserver(() => rebuildRing());
  ro.observe(card);
  rebuildRing();
  applyEstimate(); // honest ~ first paint — sets lastBlockAt so blockAgeSec() is meaningful
  seedInitialState();
  rebuildRing(); // the text just grew the card — re-measure so the ring tracks the true height
  requestAnimationFrame(() => { if (!destroyed) rebuildRing(); });
  const estInterval = setInterval(() => { if (state.est) applyEstimate(); }, 1000);
  const goInterval = setInterval(tickGoTimer, 1000); // D/H/M/S — always ticks (reduced-motion safe)
  let reducedInterval: ReturnType<typeof setInterval> | undefined;
  if (REDUCED) reducedInterval = setInterval(reducedTick, 1000);
  else rafId = requestAnimationFrame(frame);

  function destroy() {
    destroyed = true;
    cancelAnimationFrame(rafId);
    clearInterval(estInterval);
    clearInterval(goInterval);
    if (reducedInterval) clearInterval(reducedInterval);
    clearTimeout(sysTimer);
    clearTimeout(noteTimer);
    clearTimeout(R._ct);
    clearTimeout(R._prizeT);
    ro.disconnect();
  }

  return { update, destroy };
}
