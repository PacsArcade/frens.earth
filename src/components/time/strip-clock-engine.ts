/**
 * THE STRIP CLOCK engine — the pupil study's flip clock, flattened into the
 * under-menu telemetry strip (owner marked-up spec, 0018.04.27: "Shrink that
 * digital flip so it removes the words … the box will now become a more
 * flatter rectangle").
 *
 * Sources of law, REUSED never re-ported:
 *  - studies/clock-study-pupil.html via living-clock-engine.ts — the shared
 *    study constants (FIAT_SETS, GHOST_BMP, FRUITS, FIAT_CARDINALS,
 *    FIAT_EAT, strainOf, jit) are imported from there;
 *  - MoonClock.tsx — the badge-scale collapse of the study's block-paced
 *    behaviors: everything on the ring is a PURE FUNCTION of the tip height
 *    and the real block age (frightened AHEAD of Pac, GONE behind him, the
 *    board refills on the lap wrap, the currency panel rotates per block as
 *    height % 3), so the strip survives remounts and never sweeps for free.
 *
 * What the flat rectangle keeps, whole (the green circle on the mark-up):
 *  - the flip cards, now hh:mm:ss — hh:m tens are chain-exact BFT beats,
 *    the minute-ONES is the study's live struggling digit (block progress in
 *    tenths), and the NEW :ss cards tick each real second inside the current
 *    tenth (one BFT minute = ~60 s at the ten-minute pace), all driven from
 *    the tip's own chain timestamp through the one /api/chain/tip seam;
 *  - the date line ("0018.04.27 a₿" + OLD CAL) and the height INSIDE the
 *    card (the study's small HEIGHT caption) — no separate BLOCK text;
 *  - ALL the pacman: the amber pellet track around the rectangle's border,
 *    the eleven fiat ghosts at their stations, the fruit ladder / ₿ at the
 *    origin, and Pac lapping and eating (TEN laps per block).
 *
 * What the red X removed: every explainer word — %-of-the-way, LEVEL, the
 * one-liner, the LIVE/payments status. The strip is a clock, not a lecture;
 * the words live on /time (the whole strip is a door to it).
 *
 * The pellet ember holds MoonClock's static mid-breath glow (CSS, no
 * per-frame filter writes) because this strip rides every page. Estimate
 * mode wears the study's honest analog "~": dimmed pellets, ghosted Pac,
 * ~HEIGHT. Reduced motion → one calm repaint a second, everything visible.
 *
 * React owns the static skeleton (StripClock.tsx); this engine drives every
 * moving part imperatively — no ref reads in render, no setState in effects.
 */

import {
  FIAT_CARDINALS,
  FIAT_EAT,
  FIAT_SETS,
  FRUITS,
  GHOST_BMP,
  jit,
  strainOf,
} from "@/components/time/living-clock-engine";
import { bftDatePlain, bftTime, estimateHeight, estimatedBlockAtMs } from "@/lib/bb/bft";

/** One reading through the seam — height + the chain's own tip timestamp. */
export interface StripTip {
  height: number;
  /** true = the seam was dark and height is a halving-anchored ~ guess */
  estimated: boolean;
  /** unix seconds the tip block was mined (chain fact), if the seam knew */
  tipTimestamp: number | null;
}

export interface StripClockEngine {
  update(t: StripTip): void;
  destroy(): void;
}

/* ——— strip-scale geometry (the study's GEOM family, flattened) ——— */
const GEOM = {
  inset: 8, // track inset from the card edge — seats the mini ghosts
  radius: 6, // the rounded-rect corner
  dotSize: 4.5, // mempool pellet square
  dotSpacing: 10, // target arc-length between pellets
  pacR: 6, // Pac's radius; sprite ≈ 2.9× (the study's constant ratio)
  fiatScale: 0.92, // the mini fiat-ghost scale
};
const RING_SLOTS = 12; // pellet count stays divisible by the 12 clock-hours

/* the tricolor ghost body: three phase-offset silhouette layers (the study's
   buildPixelGhost); colours + shimmer live in CSS, the currency IS the face */
const GHOST_LAYERS: ReadonlyArray<readonly [string, number, number]> = [
  ["sclk-glayer sclk-glayer-lime", -0.7, -0.5],
  ["sclk-glayer sclk-glayer-core", 0, 0],
  ["sclk-glayer sclk-glayer-deep", 0.7, 0.5],
];

const SVGNS = "http://www.w3.org/2000/svg";
let clipSeq = 0; // unique clip-path ids across engine instances (strict-mode remounts)

export function createStripClock(root: HTMLElement): StripClockEngine {
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel);

  /* ——— the DOM (rendered by StripClock.tsx) ——— */
  const card = $<HTMLElement>(".sclk-card")!;
  const peri = $<SVGSVGElement>(".sclk-peri")!;
  const track = $<SVGPathElement>(".sclk-track")!;
  const pixG = $<SVGGElement>(".sclk-dots")!;
  const ghostG = $<SVGGElement>(".sclk-ghosts")!;
  const prizeG = $<SVGGElement>(".sclk-prize")!;
  const pacImg = $<SVGImageElement>(".sclk-pac")!;
  const flipEls = Array.from(root.querySelectorAll<HTMLElement>(".sclk-clock .flip"));
  const valEls = flipEls.map((f) => f.querySelector<HTMLElement>(".flip-val")!);
  const liveVal = valEls[5]; // seconds-ones — the strip's live straining card
  const liveFlip = flipEls[5];
  const hNum = $<HTMLElement>(".sclk-h-num");
  const dNum = $<HTMLElement>(".sclk-d-num");
  const oldcalEl = $<HTMLElement>(".sclk-oldcal");

  /* lastBlockAt: null = the age is UNKNOWN (a live height with no chain
     stamp) — the age-derived digits wear dashes rather than a page-load zero */
  const state = { height: null as number | null, est: true, lastBlockAt: null as number | null };
  const blockAge = () =>
    state.lastBlockAt == null ? 0 : Math.max(0, (Date.now() - state.lastBlockAt) / 1000);

  /* ═══ THE CHOMP CLIP — Pac's mouth wedge, authored in the sprite's own
     local frame so it rides the rotate() and always faces travel ═══ */
  let mouthPath: SVGPathElement | null = null;
  {
    let defs = peri.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS(SVGNS, "defs");
      peri.insertBefore(defs, peri.firstChild);
    }
    while (defs.firstChild) defs.removeChild(defs.firstChild); // idempotent (strict-mode remount)
    const cpId = `sclk-mouthclip-${++clipSeq}`;
    const cp = document.createElementNS(SVGNS, "clipPath");
    cp.setAttribute("id", cpId);
    cp.setAttribute("clipPathUnits", "userSpaceOnUse");
    mouthPath = document.createElementNS(SVGNS, "path");
    cp.appendChild(mouthPath);
    defs.appendChild(cp);
    pacImg.setAttribute("clip-path", `url(#${cpId})`);
  }

  /* ═══ the flat rounded-rect track — origin at top-center (the "12") ═══ */
  let L = 0;
  function rebuildTrack() {
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    if (!w || !h) return;
    const i = GEOM.inset;
    const r = GEOM.radius;
    const d =
      `M ${w / 2} ${i} L ${w - i - r} ${i} A ${r} ${r} 0 0 1 ${w - i} ${i + r}` +
      ` L ${w - i} ${h - i - r} A ${r} ${r} 0 0 1 ${w - i - r} ${h - i}` +
      ` L ${i + r} ${h - i} A ${r} ${r} 0 0 1 ${i} ${h - i - r}` +
      ` L ${i} ${i + r} A ${r} ${r} 0 0 1 ${i + r} ${i} Z`;
    peri.setAttribute("width", String(w));
    peri.setAttribute("height", String(h));
    peri.setAttribute("viewBox", `0 0 ${w} ${h}`);
    track.setAttribute("d", d);
    L = track.getTotalLength();
    buildGhosts();
    buildDots();
    buildPrize();
    stillFrame(); // never a stale ring after a resize
  }
  const at = (f: number) => track.getPointAtLength((((f % 1) + 1) % 1) * L);

  /* ═══ the mempool pellets — equidistant, station-guarded (the study's
     coinPad/ghostPad: pellets flanking each clock-hour are suppressed) ═══ */
  let N = 0;
  let dots: (SVGRectElement | null)[] = [];
  const dotOps: string[] = [];
  let frontIndex = -1;
  function buildDots() {
    if (!L) return;
    while (pixG.firstChild) pixG.removeChild(pixG.firstChild);
    N = Math.max(24, RING_SLOTS * Math.round(L / GEOM.dotSpacing / RING_SLOTS));
    dots = [];
    dotOps.length = 0;
    frontIndex = -1;
    const bin = 1 / N;
    const guardPad = 1.05 * bin;
    const guards = [0, ...FIAT_CARDINALS];
    for (let i = 0; i < N; i++) {
      const f = (i + 0.5) / N;
      let skip = false;
      for (const g of guards) {
        let d = Math.abs(f - g);
        d = Math.min(d, 1 - d);
        if (d < guardPad) {
          skip = true;
          break;
        }
      }
      if (skip) {
        dots.push(null); // keeps index → fraction alignment
        continue;
      }
      const p = at(f);
      const rect = document.createElementNS(SVGNS, "rect");
      rect.setAttribute("x", (p.x - GEOM.dotSize / 2).toFixed(1));
      rect.setAttribute("y", (p.y - GEOM.dotSize / 2).toFixed(1));
      rect.setAttribute("width", String(GEOM.dotSize));
      rect.setAttribute("height", String(GEOM.dotSize));
      rect.setAttribute("rx", "1");
      rect.setAttribute("class", "sclk-pix");
      rect.style.opacity = "0.09";
      pixG.appendChild(rect);
      dots.push(rect);
    }
  }
  /* classic pellets: bright ahead of Pac, GONE behind him; the board refills
     each lap (the wrap does it — opacity is pure lap-position) */
  function renderDots(pacFrac: number) {
    if (!N) return;
    const bright = (state.est ? 0.6 : 1).toFixed(3);
    const eatenEdge = pacFrac + (GEOM.pacR * 0.5) / L;
    let fi = -1;
    for (let i = 0; i < N; i++) {
      const d = dots[i];
      if (!d) continue;
      const f = (i + 0.5) / N;
      const op = f < eatenEdge ? "0" : bright;
      if (dotOps[i] !== op) {
        d.style.opacity = op;
        dotOps[i] = op;
      }
      if (fi < 0 && f >= pacFrac) fi = i; // the next pellet Pac will eat
    }
    if (fi !== frontIndex) {
      if (frontIndex >= 0) dots[frontIndex]?.classList.remove("front");
      if (fi >= 0) dots[fi]?.classList.add("front");
      frontIndex = fi;
    }
  }

  /* ═══ THE FIAT GHOSTS at the clock-hour stations — frightened AHEAD of
     Pac, GONE behind him; the currency panel rotates once per block ═══ */
  let fiatIdx = 0;
  const ghosts: { el: SVGGElement; glyph: SVGTextElement; st: string; cur: string }[] = [];
  function buildGhosts() {
    while (ghostG.firstChild) ghostG.removeChild(ghostG.firstChild);
    ghosts.length = 0;
    for (const f of FIAT_CARDINALS) {
      const p = at(f);
      const el = document.createElementNS(SVGNS, "g");
      el.setAttribute("class", "sclk-ghost");
      el.setAttribute(
        "transform",
        `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${GEOM.fiatScale})`
      );
      /* the LIFE layer — the blink rides here so the parent keeps its
         pinned position transform (the study's .g-inner) */
      const inner = document.createElementNS(SVGNS, "g");
      inner.setAttribute("class", "sclk-ginner");
      for (const [cls, dx, dy] of GHOST_LAYERS) {
        const layer = document.createElementNS(SVGNS, "g");
        layer.setAttribute("class", cls);
        layer.setAttribute("transform", `translate(${dx} ${dy})`);
        for (let r = 0; r < GHOST_BMP.length; r++)
          for (let c = 0; c < 11; c++) {
            if (GHOST_BMP[r][c] !== "1") continue;
            const px = document.createElementNS(SVGNS, "rect");
            px.setAttribute("x", (c - 5.5).toFixed(1));
            px.setAttribute("y", (r - 5.5).toFixed(1));
            px.setAttribute("width", "1");
            px.setAttribute("height", "1");
            layer.appendChild(px);
          }
        inner.appendChild(layer);
      }
      const glyph = document.createElementNS(SVGNS, "text");
      glyph.setAttribute("class", "sclk-glyph");
      glyph.setAttribute("x", "0");
      glyph.setAttribute("y", "-0.4");
      inner.appendChild(glyph); // glyph LAST → on top: the currency IS the face
      el.appendChild(inner);
      ghostG.appendChild(el);
      ghosts.push({ el, glyph, st: "", cur: "" });
    }
  }
  function renderGhosts(lapFrac: number) {
    const set = FIAT_SETS[fiatIdx];
    for (let i = 0; i < ghosts.length; i++) {
      const gh = ghosts[i];
      /* eaten the instant Pac's mouth reaches it (the study's FIAT_EAT) */
      const stx = lapFrac + FIAT_EAT >= FIAT_CARDINALS[i] ? "eaten" : "blue";
      if (gh.st !== stx) {
        gh.el.classList.toggle("eaten", stx === "eaten");
        gh.st = stx;
      }
      if (gh.cur !== set[i]) {
        gh.glyph.textContent = set[i];
        gh.cur = set[i];
      }
    }
  }

  /* ═══ THE PRIZE at the origin — the fruit ladder, laps 1–9; the TENTH
     lap is the ₿ itself (the static-safe gold coin face — the spinning
     bitcoin.gif stays on the /time card and the study bench) ═══ */
  let prizeLap = -1;
  let fruitPlate: SVGCircleElement | null = null;
  let fruitFace: SVGTextElement | null = null;
  let coinBack: SVGCircleElement | null = null;
  let coinB: SVGTextElement | null = null;
  function buildPrize() {
    while (prizeG.firstChild) prizeG.removeChild(prizeG.firstChild);
    const p0 = at(0);
    prizeG.setAttribute("transform", `translate(${p0.x.toFixed(1)} ${p0.y.toFixed(1)})`);
    fruitPlate = document.createElementNS(SVGNS, "circle");
    fruitPlate.setAttribute("class", "sclk-fruit-plate");
    fruitPlate.setAttribute("r", "8");
    prizeG.appendChild(fruitPlate);
    fruitFace = document.createElementNS(SVGNS, "text");
    fruitFace.setAttribute("class", "sclk-fruit");
    prizeG.appendChild(fruitFace);
    coinBack = document.createElementNS(SVGNS, "circle");
    coinBack.setAttribute("class", "sclk-coin-back");
    coinBack.setAttribute("r", "6.5");
    prizeG.appendChild(coinBack);
    coinB = document.createElementNS(SVGNS, "text");
    coinB.setAttribute("class", "sclk-coin-b");
    coinB.textContent = "₿";
    prizeG.appendChild(coinB);
    prizeLap = -1;
  }
  function setPrize(lap: number) {
    if (lap === prizeLap) return;
    prizeLap = lap;
    const isCoin = lap >= 9; // the tenth lap: the ₿ itself
    if (fruitPlate) fruitPlate.style.display = isCoin ? "none" : "";
    if (fruitFace) {
      fruitFace.style.display = isCoin ? "none" : "";
      if (!isCoin) fruitFace.textContent = FRUITS[lap];
    }
    if (coinBack) coinBack.style.display = isCoin ? "" : "none";
    if (coinB) coinB.style.display = isCoin ? "" : "none";
  }

  /* ═══ Pac on the flat track — faces travel; the mouth is the clip wedge ═══ */
  let pacSized = false;
  function drawPac(frac: number, halfDeg: number) {
    if (!L) return;
    const w = GEOM.pacR * 2.9; // sprite size ≈ Pac diameter (CONSTANT, never pulses)
    if (!pacSized) {
      pacImg.setAttribute("width", w.toFixed(1));
      pacImg.setAttribute("height", w.toFixed(1));
      pacImg.setAttribute("x", (-w / 2).toFixed(1));
      pacImg.setAttribute("y", (-w / 2).toFixed(1));
      pacSized = true;
    }
    const P = at(frac);
    const P2 = at(frac + Math.max(0.002, 1 / L));
    const deg = (Math.atan2(P2.y - P.y, P2.x - P.x) * 180) / Math.PI;
    pacImg.setAttribute(
      "transform",
      `translate(${P.x.toFixed(2)} ${P.y.toFixed(2)}) rotate(${deg.toFixed(1)})`
    );
    if (mouthPath) {
      const m = (Math.max(2, halfDeg) * Math.PI) / 180;
      const r0 = w * 0.55; // clip disc covers the whole sprite body
      const x1 = (r0 * Math.cos(m)).toFixed(2);
      const y1 = (r0 * Math.sin(m)).toFixed(2);
      const y2 = (-r0 * Math.sin(m)).toFixed(2);
      mouthPath.setAttribute(
        "d",
        `M 0 0 L ${x1} ${y1} A ${r0.toFixed(2)} ${r0.toFixed(2)} 0 1 1 ${x1} ${y2} Z`
      );
    }
  }

  /* ═══ the flip digits — hh : m[tens][LIVE tenth] : ss ═══
     hh and minute-tens are chain-exact BFT beats (bftTime); the minute-ONES
     is the study's live digit (block progress in tenths = Pac's lap); the
     :ss pair counts the real seconds inside the current tenth — one BFT
     minute is ~60 s at the ten-minute pace, anchored to the tip timestamp. */
  function flipTo(i: number, v: string) {
    const valEl = valEls[i];
    const flipEl = flipEls[i] as HTMLElement & { _ft?: ReturnType<typeof setTimeout> };
    if (!valEl || valEl.textContent === v) return;
    valEl.textContent = v;
    flipEl.classList.remove("flipping");
    void flipEl.offsetWidth;
    flipEl.classList.add("flipping");
    clearTimeout(flipEl._ft);
    flipEl._ft = setTimeout(() => flipEl.classList.remove("flipping"), 600);
  }
  function drawDigits() {
    if (state.height == null) return;
    const [hh, mm] = bftTime(state.height).split(":");
    flipTo(0, hh[0]);
    flipTo(1, hh[1]);
    flipTo(2, mm[0]);
    if (state.lastBlockAt == null) {
      /* a live height with no chain stamp — the age is UNKNOWN: dashes,
         never a fresh page-load count (the reload-restarts-age law) */
      flipTo(3, "-");
      flipTo(4, "-");
      flipTo(5, "-");
      return;
    }
    /* the block's own clock: 0..599 s, clamped — a late block HOLDS at
       m9:59 and strains (the standing strain rule), never lies forward */
    const totalSec = Math.min(599, Math.floor(blockAge()));
    flipTo(3, String(Math.floor(totalSec / 60)));
    const ss = totalSec % 60;
    flipTo(4, String(Math.floor(ss / 10)));
    flipTo(5, String(ss % 10));
  }

  /* the strain — THE LOADED CHAIN (owner ruling, clock suggestion 2's
     orange marks): past ten minutes, every digit the next block-land will
     flip trembles — the live card hardest, the pulse rippling leftward on
     a stagger so you can feel it travel through the clock — and the
     straining digits WARM from cream toward the 624 ember, snapping back
     the moment the block lands. Before ten minutes the face stays calm:
     the trembling has to mean something. At 39:59 the whole 9-5-9-3 chain
     shivers; at 32:14 only the live card does — the vibration shows how
     much of the clock the next block will move. */
  const CREAM_RGB = [242, 240, 234] as const;
  const EMBER_RGB = [255, 102, 0] as const;
  function applyStrain(nowSec: number) {
    if (!liveVal || !liveFlip) return;
    const age = blockAge();
    const { glow, amp } = strainOf(age);
    const chainK = Math.min(1, Math.max(0, (age - 600) / 600));
    /* which digits does the next land flip? compare this face to height+1's
       fresh face — that's the spring the late block is loading */
    let chain = [false, false, false, true, true, true];
    if (state.height != null && chainK > 0) {
      const [ch] = [bftTime(state.height)];
      const nx = bftTime(state.height + 1);
      chain = [ch[0] !== nx[0], ch[1] !== nx[1], ch[3] !== nx[3], true, true, true];
    }
    valEls.forEach((el, i) => {
      const isLive = i === 5;
      const k = isLive ? (amp > 0 ? 1 : 0) : chain[i] ? chainK : 0;
      if (k <= 0) {
        el.style.transform = "";
        el.style.color = "";
        return;
      }
      const w = 0.3 + 0.7 * (i / 5); // rightmost strongest, fading leftward
      el.style.transform = REDUCED
        ? ""
        : `rotateX(${(amp * 9 * w * k * jit(nowSec - (5 - i) * 0.18, 3.1 + i * 0.37)).toFixed(2)}deg)`;
      const warm = Math.min(1, chainK * w);
      el.style.color =
        warm > 0.02
          ? `rgb(${Math.round(CREAM_RGB[0] + (EMBER_RGB[0] - CREAM_RGB[0]) * warm)}, ${Math.round(
              CREAM_RGB[1] + (EMBER_RGB[1] - CREAM_RGB[1]) * warm
            )}, ${Math.round(CREAM_RGB[2] + (EMBER_RGB[2] - CREAM_RGB[2]) * warm)})`
          : "";
    });
    liveFlip.style.boxShadow =
      glow > 0.05
        ? `0 0 ${(3 + 10 * glow).toFixed(0)}px rgba(247,147,26,${(0.12 + 0.35 * glow).toFixed(2)})`
        : "";
  }

  /* ═══ the facts INSIDE the card — height + the date line, nothing else ═══ */
  function renderMeta() {
    if (state.height == null) return;
    const tilde = state.est ? "~" : "";
    if (hNum) hNum.textContent = `${tilde}${state.height.toLocaleString("en-US")}`;
    if (dNum) dNum.textContent = bftDatePlain(state.height);
    if (oldcalEl) {
      const d = new Date();
      oldcalEl.textContent = `OLD CAL · ${d
        .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
        .toUpperCase()}`;
    }
  }

  /* ═══ the lap law: TEN laps per block (the study's lapOf) ═══ */
  function lapNow() {
    const prog = Math.min(0.999, blockAge() / 600);
    const lap = Math.min(9, Math.floor(prog * 10));
    return { lap, lapFrac: Math.min(0.999, prog * 10 - lap) };
  }

  /* offline / cold-boot: the halving-anchored honest ~ (estimateHeight —
     house law: the flat genesis 10-min model runs ~8–9 months behind the
     chain and is banned for "now"); the model's own block phase keeps the
     seconds ticking, so the ~ never restarts at :00 on a reload */
  function applyEstimate() {
    const est = estimateHeight();
    if (state.height !== est || !state.est) {
      state.height = est;
      state.est = true;
      root.classList.add("est");
      fiatIdx = est % FIAT_SETS.length;
      renderMeta();
    }
    state.lastBlockAt = Math.min(Date.now(), estimatedBlockAtMs(est));
  }

  /* one calm, exact repaint — the reduced-motion pose and the first paint */
  function stillFrame() {
    if (state.height == null) return;
    const { lap, lapFrac } = lapNow();
    drawPac(lapFrac, 34); // the mouth holds mid-open (the study's reducedTick)
    renderDots(lapFrac);
    renderGhosts(lapFrac);
    setPrize(lap);
    drawDigits();
    applyStrain(performance.now() / 1000);
  }

  let raf = 0;
  let reducedInterval: ReturnType<typeof setInterval> | null = null;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (state.est) applyEstimate(); // the ~ keeps counting across rollovers
    if (state.height == null) return;
    const t = now / 1000;
    const chomp = 0.5 - 0.5 * Math.cos(t * Math.PI * 2 * 2.6); // ~2.6 Hz arcade chomp
    const { lap, lapFrac } = lapNow();
    drawPac(lapFrac, 8 + 48 * chomp);
    renderDots(lapFrac);
    renderGhosts(lapFrac);
    setPrize(lap);
    drawDigits();
    applyStrain(t);
  }

  /* ═══ the seam in — StripClock relays /api/chain/tip readings here ═══ */
  function update(t: StripTip) {
    if (t.estimated) {
      applyEstimate();
      stillFrame();
      return;
    }
    /* the block age anchors to the CHAIN's own timestamp when the seam gave
       it — every clock in the fleet agrees on Pac's lap and the seconds no
       matter when this page loaded (miner-skew clamped to now) */
    if (t.tipTimestamp != null) {
      state.lastBlockAt = Math.min(t.tipTimestamp * 1000, Date.now());
    } else if (state.height != null && !state.est && t.height > state.height) {
      /* an OBSERVED break while live — the one honest wall-clock seed */
      state.lastBlockAt = Date.now();
    } else if (state.height !== t.height || state.est) {
      /* a bare height with no stamp: the age is unknown — dash it (never
         restart the count at page load) until a stamp or an observed break */
      state.lastBlockAt = null;
    }
    state.height = t.height;
    state.est = false;
    root.classList.remove("est");
    /* rotate the world's monies once per block — a pure function of height
       (the study's per-block panel rotation, remount-proof) */
    fiatIdx = ((t.height % FIAT_SETS.length) + FIAT_SETS.length) % FIAT_SETS.length;
    renderMeta();
    stillFrame(); // snap everything into place now — the loop takes it from here
  }

  /* ═══ boot ═══ */
  const ro = new ResizeObserver(() => rebuildTrack());
  ro.observe(card);
  rebuildTrack();
  applyEstimate(); // honest ~ first paint; the first live reading replaces it
  stillFrame();
  if (REDUCED) reducedInterval = setInterval(stillFrame, 1000);
  else raf = requestAnimationFrame(frame);

  return {
    update,
    destroy() {
      cancelAnimationFrame(raf);
      if (reducedInterval) clearInterval(reducedInterval);
      ro.disconnect();
    },
  };
}
