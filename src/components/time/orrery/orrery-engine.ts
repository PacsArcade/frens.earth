import { skyMoon, moonFracAt } from '@/lib/bb/moon';
/**
 * THE ORRERY engine — Act I of the orrery study, ported whole.
 *
 * Source of truth: studies/clock-study-orrery.html (v27, owner-approved).
 * This file is the study's own JS — the block math, the anchor table, the
 * twelve rings, the sun, the moon, the houses, the scrub/NOW/date-picker
 * wiring — adapted to the ship: the DOM skeleton is rendered by Orrery.tsx
 * (same structure, class-scoped instead of ids), and the network plumbing
 * walks THE LADDER — this ship's own same-origin seam /api/chain/tip?full=1
 * first (node-first + public fallback SERVER-side, the pluggable knob), the
 * arcade's time server second (time.pacsarcade.org, CORS open), and the
 * genesis-anchored ten-minute model last, wearing the honest ~.
 *
 * Stays in the study (owner ruling: "only ship the part 1 — the 1a, 2 and 3
 * sections are still under development"): the spirograph (Act I·B), the
 * tape (Act II), star birth facts (Act III).
 *
 * The laws ported intact (v23):
 *  - 12 orbit rings around the 624-ember sun (THE LIGHT), the Admiral's
 *    order: sun · SECOND · MINUTE · HOUR · BLOCK · DAY · FORTNIGHT ·
 *    MONTH · MOON · YEAR · HALVING · GENERATION · LAST SAT.
 *  - every dot carries its READING; laps fill at the TOP; watchmaker
 *    ticks; ALL dots rest identical in the CREAM (the MOON keeps its
 *    phase face).
 *  - the sun: "BITCOIN TIME", hh:mm:ss with the seconds living INSIDE the
 *    block (chain timestamp when the seam gives it), holds at :59 and
 *    strains past 600 s — never lies, visibly struggles; THE 624 PULSE
 *    breathes its fill from the brand coin-orange up to the true ember.
 *  - ONE selection language, every ring: the chosen ring lights an ORANGE
 *    ember arc for what's full, a BLUE arc for what remains, and its dot
 *    lights GOLD — the one selection color for every dot (owner ruling,
 *    v23: "like the halving's, fleet-wide") — all hidden at rest; the
 *    fact card names the remainder — "X% to go".
 *  - ring labels riding the orbit lines; the MOON at its true phase
 *    (northern sky); the 13 houses CAPRICORN-FIRST (the MONTH-SEAT LAW —
 *    month N of 13 sits in the Nth house; Ophiuchus keeps his true seat)
 *    behind the ✶ HOUSES toggle, every glyph naming its seat in a hover
 *    <title>, the current month's wedge softly lit in the ember; hover
 *    tooltips on every planet; the gravity-well gradient in the same
 *    ember; gold = money — the gold selection dot is the owner's ruled
 *    exception.
 *  - scrub 0→6,930,000 + NOW; SET THE CLOCK takes ANY date — pre-genesis
 *    reads negative (b₿, blocks before genesis); reduced motion = a 1 s
 *    in-place refresh, no rAF.
 *
 * v24, layered on top:
 *  - every fact card counts its lap in BLOCKS;
 *  - the 13 sign NAMES ride the rim in small curved text under their
 *    glyphs (two textPath tracks, CW upper / CCW lower so all read
 *    upright — they live in the zodiac group: ✶ HOUSES douses them);
 *  - THE WANDERERS — the real planets at ~mean ecliptic longitude (J2000
 *    elements) on a dashed sky band between GENERATION and LAST SAT,
 *    tiny true-color bodies + symbol glyphs + lap-in-blocks tooltips,
 *    behind the ☿ PLANETS chip (lit by default); the sky rides the clock
 *    (scrub / date picker move it), tooltips recut only on house change;
 *  - the selector chips wear the study's deterministic little planet
 *    dots (.pdot art) inside this ship's collapsible planet-dot column:
 *    collapsed dots ARE the planet art, expanded chips show dot + name;
 *  - the study's data-sel scoping law: renderFact's chip sweep touches
 *    only data-sel chips, so the HOUSES/PLANETS toggles keep their light.
 *
 * v26, layered on top — KEPLER RINGS MODE:
 *  - the ☿ chip cycles BAND → RINGS → OFF ('☿ BAND' / '☿ RINGS' / the
 *    dimmed '☿ PLANETS', per-state title + aria). In RINGS the WHOLE dial
 *    re-sorts by true lap period — 18 orbits (12 time rings + the six
 *    wanderers, each on its own faint dashed orbit), radii 62→258 from
 *    the KEPLER table; the true near-pairs are drawn almost touching
 *    (MONTH↔EARTH 5px, JUPITER↔YEAR 7px, GENERATION↔SATURN 7px — the
 *    kiss IS the lesson) and speak their kiss-notes in the fact cards
 *    and hover tooltips, rings state only. BAND restores the ruled radii
 *    exactly, the wanderers back on their shared sky band; OFF is the
 *    ruled order with no planets. The layout is parameterized IN PLACE
 *    (per-ring refs + a live cr radius + applyLayout() re-setting the
 *    attributes from radiusOf(key, mode)) — no teardown, no rebuild, no
 *    new listeners: selection, lit-states, scrub/pick and the rAF loop
 *    all survive the cycle. Zodiac rim, names, spokes, wedge, sun fixed.
 *
 * v27, layered on top:
 *  - THE WEEK RING — 1,008 blocks = 7 block-days; the dot reads week 1–4
 *    of the month and its lap FILLS the month (DAY's own counting law —
 *    a month is exactly four weeks: no ragged weeks, ever), 4 ticks.
 *    13 rings now: SECOND · MINUTE · HOUR · BLOCK · DAY · WEEK ·
 *    FORTNIGHT · MONTH · MOON · YEAR · OLYMPIAD · GENERATION · LAST SAT.
 *    Ruled radii rebalanced 62→258 (GENERATION holds 234, the sky band
 *    holds 246); KEPLER is 19 orbits (WEEK laps the month in DAY's
 *    cluster — ruled precedence DAY → WEEK → MOON), kisses kept.
 *  - HALVING renamed OLYMPIAD (ring, chip, NUMS) — the dot still counts
 *    halvings-so-far, gold on selection stays, 4 ticks stay.
 *  - THE COPY LAW: every fact card reads [NAME + block time] · [current
 *    reading] · [old-world relation] · [% to go], minimal words; the
 *    kiss-notes ride as their own short final segments.
 *  - THE WRAP LAW: the card renders atomic inline-block/nowrap segments
 *    with the ' ·' separator bound to the TAIL of the segment before it —
 *    a wrapped line can never open with '·' and no segment ever breaks
 *    inside itself (the owner's phone-review screenshots).
 *  - THE DATE-FIELD LAW: iOS/WebKit draws an empty date input as a blank
 *    gray select-looking pill — SET THE CLOCK defaults to today (no
 *    change event fires; the dial stays live until the fren picks).
 */

export interface OrreryEngine {
  destroy(): void;
}

/*==MATH== — ported verbatim from the study ==*/
/* ——— the block constants: the only clock bitcoin owns ——— */
const DAY = 144, WEEK = 1008, DIFF = 2016, MONTH = 4032, YEAR = 52416, HALV = 210000,
  CYCLE = 1260000, LAST = 6930000;
const GENESIS_MS = Date.UTC(2009, 0, 3, 18, 15, 5);

/* ——— gregorian ⇄ height: piecewise through real anchors, steady ~10 min elsewhere ——— */
const ANCH: Array<[number, number]> = [
  [0, GENESIS_MS],                        // genesis
  [57043, Date.UTC(2010, 4, 22)],         // pizza day
  [210000, Date.UTC(2012, 10, 28)],       // halving I
  [420000, Date.UTC(2016, 6, 9)],         // halving II
  [630000, Date.UTC(2020, 4, 11)],        // halving III
  [840000, Date.UTC(2024, 3, 20)],        // halving IV
  [957877, Date.UTC(2026, 6, 13, 16, 13, 46)], // the pupil's honest anchor — keeps the offline model within a whisker of now
];

/* ——— the BFT calendar: 13 months × 28 days, year = bitcoin's age ——— */
interface BftD { y: number; mo: number; d: number; era: string; str: string }
function bftDate(h: number): BftD {
  const H = Math.floor(h);
  const era = H >= 0 ? 'a₿' : 'b₿';
  const m = H >= 0 ? H : -H;                 // b₿ mirrors around genesis
  const y = Math.floor(m / YEAR);
  const mo = Math.floor((m % YEAR) / MONTH) + 1;
  const d = Math.floor((m % MONTH) / DAY) + 1;
  return { y, mo, d, era, str:
    String(y).padStart(4, '0') + '.' + String(mo).padStart(2, '0') + '.' + String(d).padStart(2, '0') + ' ' + era };
}

/* ——— the 13-wheel of year animals: a₿ 0 = Ox; the Cat rides thirteenth ——— */
const ANIMALS: Array<[string, string]> = [['🐀', 'Rat'], ['🐂', 'Ox'], ['🐅', 'Tiger'],
  ['🐇', 'Rabbit'], ['🐉', 'Dragon'], ['🐍', 'Snake'], ['🐎', 'Horse'], ['🐐', 'Goat'],
  ['🐒', 'Monkey'], ['🐓', 'Rooster'], ['🐕', 'Dog'], ['🐖', 'Pig'], ['🐈', 'Astronomical Cat']];
function yearAnimal(d: BftD) {
  const i = (((d.era === 'b₿' ? 1 - d.y : d.y + 1) % 13) + 13) % 13;
  return ANIMALS[i];
}

/* ——— the sky's moon ———
   Moved to lib/bb/moon.ts so the orrery and the mobile half-wheel read the
   SAME moon. They disagreed until 2026-07-28: the orrery drew the sky while
   the half-wheel drew BFT's 28-day calendar lunation, which by then had
   drifted half a cycle. One source, one moon. */
function moonAt(ms: number) {
  const m = skyMoon(ms);
  return [m.emoji, m.name] as [string, string];
}

/* ——— THE 13 HOUSES (experiment): the real astronomical zodiac has
   thirteen signs — Ophiuchus ⛎ is the one astrology leaves out, the sky's
   own Astronomical Cat. One house per bitcoin month, sector 1 at the top,
   read clockwise. A planet is IN the house its dot stands in. ——— */
const ZOD13: Array<[string, string]> = [['♑', 'Capricorn'], ['♒', 'Aquarius'], ['♓', 'Pisces'],
  ['♈', 'Aries'], ['♉', 'Taurus'], ['♊', 'Gemini'], ['♋', 'Cancer'], ['♌', 'Leo'],
  ['♍', 'Virgo'], ['♎', 'Libra'], ['♏', 'Scorpio'], ['⛎', 'Ophiuchus'], ['♐', 'Sagittarius']];
/* Capricorn opens the year — genesis (3 Jan) and Day 0 (~7 Jan) both land
   in month 1. MONTH SEAT LAW: month N of 13 sits in the Nth house, same
   reading as the bitcoin-birthday page. Ophiuchus keeps his true seat. */
const houseOf = (frac: number) => ZOD13[Math.floor(((frac % 1) + 1) % 1 * 13) % 13];

/* ——— THE WANDERERS (experiment layer): the real planets of our solar
   system, placed at their MEAN ecliptic longitudes — J2000 elements
   (L0 at epoch 2000-01-01 12:00 UTC, mean motion n °/day). This is
   wonder-grade (~), NOT an ephemeris: no equation of center, so true
   positions can differ by a few degrees (Mars up to ~10°). Dial law:
   0° longitude sits at the START of the ARIES sector — sector 4 of the
   Capricorn-first dial, i.e. 3/13 of the circle past the top — and
   longitude increases CLOCKWISE, matching the dial's own direction.
   Laps quoted in blocks at ~10 min each. ☿ PLANETS lights and douses. */
const J2000 = Date.UTC(2000, 0, 1, 12), SKY_R = 246;
/* v27 copy law rides the wanderers too: NAME first, the lap in blocks,
   then the old-world relation — the tooltip is built in renderWander */
interface Wanderer { sym: string; name: string; L0: number; n: number; note?: string; lap: string; old: string }
const WANDER: Wanderer[] = [
  { sym: '☿', name: 'MERCURY', L0: 252.25, n: 4.09233,
    lap: '≈12,672 blocks', old: 'the old world’s ~88 days' },
  { sym: '♀', name: 'VENUS', L0: 181.98, n: 1.60213,
    lap: '≈32,400 blocks', old: 'the old world’s ~225 days' },
  { sym: '🜨', name: 'EARTH', L0: 100.46, n: 0.98565, note: 'we ride this one, fren',
    lap: '≈52,596 blocks', old: 'one old-world year — a bitcoin year + ~180 blocks of drift' },
  { sym: '♂', name: 'MARS', L0: 355.43, n: 0.52403,
    lap: '≈98,928 blocks', old: 'the old world’s ~687 days' },
  { sym: '♃', name: 'JUPITER', L0: 34.35, n: 0.08309,
    lap: '≈624,000 blocks', old: '~11.86 years — almost three halvings' },
  { sym: '♄', name: 'SATURN', L0: 50.08, n: 0.03346,
    lap: '≈1,550,000 blocks', old: '~29.5 years — the Saturn return' },
];
const wanderFrac = (w: Wanderer, ms: number) =>
  pmod(3 / 13 + pmod(w.L0 + w.n * ((ms - J2000) / 86400000), 360) / 360, 1);

/* ——— KEPLER RINGS MODE (v26; re-spaced v27): the ☿ chip cycles
   BAND → RINGS → OFF. In RINGS the whole dial re-sorts by TRUE LAP
   PERIOD in blocks — SECOND 0.1 · MINUTE 6 · HOUR 144 · BLOCK 144 ·
   FORTNIGHT 2,016 · DAY 4,032 · WEEK 4,032 (the month's own cluster —
   ruled precedence DAY then WEEK) · MOON ≈4,252 · MERCURY 12,672 ·
   VENUS 32,400 · MONTH 52,416 · EARTH 52,596 · MARS 98,928 ·
   OLYMPIAD 210,000 · JUPITER 624,000 · YEAR 681,408 ·
   GENERATION 1,260,000 · SATURN ≈1,550,000 · LAST SAT 6,930,000 —
   19 orbits, 62→258.
   True near-pairs are deliberately drawn ALMOST TOUCHING (the kiss is
   the lesson): MONTH↔EARTH 5px — one earth year ≈ one bitcoin year,
   ~180 blocks of drift; JUPITER↔YEAR 7px — Jupiter hugs the animal
   wheel; GENERATION↔SATURN 7px — the Saturn return next door to a
   human generation. Normal gaps 11.8px (= (196−19)/15). ——— */
const KEPLER: Record<string, number> = {
  SECOND: 62, MINUTE: 73.8, HOUR: 85.6, BLOCK: 97.4, FORTNIGHT: 109.2,
  DAY: 121, WEEK: 132.8, MOON: 144.6, MERCURY: 156.4, VENUS: 168.2,
  MONTH: 180, EARTH: 185, MARS: 196.8, OLYMPIAD: 208.6, JUPITER: 220.4,
  YEAR: 227.4, GENERATION: 239.2, SATURN: 246.2, 'LAST SAT': 258,
};
/* the kiss-notes — spoken ONLY in rings state, where the near-touch
   shows; each is its OWN short segment (v27 wrap law) */
const KISS: Record<string, string> = {
  MONTH: 'EARTH orbits ~180 blocks away',
  YEAR: 'JUPITER next door — ≈3 halvings',
  GENERATION: 'SATURN next door — the return',
};

/*==/MATH==*/

const nf = (n: number) => Math.abs(n).toLocaleString('en-US');
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SVGNS = 'http://www.w3.org/2000/svg';
const CREAM = '#f2ead8', GOLD = '#ffd700', CYAN = '#6fd7e0';
const BTC = '#ff6600';   /* THE 624 EMBER — vivid tangerine. the block interval
   IS the color: 1/600 Hz raised 58 octaves ≈ 432 THz ≈ 624 nm orange-red
   (#FF4500–#FF6600, the sacred band — the Hatter's discovery). NOT the
   brand coin-orange #f7931a: the sun burns at the protocol's own light. */

const bidOf = (H: number) => ((Math.floor(H) % DAY) + DAY) % DAY;
const capA = (a: number) => Math.min(Math.max(a, 0), 599.9);
const pmod = (x: number, p: number) => ((x % p) + p) % p;   // positive modulo — b₿ heights welcome
const pct = (H: number, p: number) => ((H % p) / p * 100).toFixed(1) + '%';

/* the face, all the way down: hh:mm:ss — six blocks an hour, ten minutes a
   block, and the seconds live INSIDE the block. past 600 s the face holds
   at :59 and strains — the pupil law: never lie, visibly struggle. */
function faceTime(H: number, age: number) {
  const bid = bidOf(H);
  const a = capA(age);
  return {
    hh: String(Math.floor(bid / 6)).padStart(2, '0'),
    mm: String((bid % 6) * 10 + Math.floor(a / 60)).padStart(2, '0'),
    ss: String(Math.floor(a % 60)).padStart(2, '0'),
    strain: age >= 600,
  };
}

interface RingDef {
  key: string;
  p: number;
  r: number;
  pr: number;
  c: string;
  ticks?: number;
  moon?: boolean;
  arc?: boolean;
  fr?: (H: number, a: number) => number;
  /* v27 COPY LAW: f returns an ARRAY of short segments — [NAME + block
     time] · [current reading] · [old-world relation] (· extras) —
     renderFact wraps each in a nowrap span and appends the '% to go' */
  f: (H: number, a: number) => string[];
  n?: (H: number, a: number) => string;
}

interface Planet {
  pl?: SVGGElement;
  lit?: SVGCircleElement | null;
  num?: SVGTextElement | null;
  hit: SVGCircleElement;
  ring?: SVGCircleElement;
  rg?: RingDef;
  fillA?: SVGCircleElement;
  remA?: SVGCircleElement;
  dot?: SVGCircleElement | null;
  tt?: SVGTitleElement;
  /* v26 KEPLER RINGS — the layout is parameterized in place: every
     radius-dependent element keeps a ref, and cr is the LIVE radius
     (ruled at rest, KEPLER in rings state); applyLayout() re-sets the
     attributes from radiusOf(key, mode) with NO teardown, NO new
     listeners — selection, lit-states and the rAF loop all survive. */
  lblPath?: SVGPathElement;
  tickEls?: SVGLineElement[];
  cr?: number;
  /* the mobile pass: the whole orbit LINE is a tap target — an invisible
     fat-stroke twin of the ring (CSS .ringhit; fatter on coarse pointers)
     wearing the same data-i, laid UNDER the dots so a dot tap still wins */
  bandHit?: SVGCircleElement;
}

let seq = 0; // unique SVG-reference ids across engine instances (strict-mode remounts)

export function createOrrery(root: HTMLElement): OrreryEngine {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const uid = 'orr' + ++seq;
  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;

  /* ═══ the DOM (rendered by Orrery.tsx — same shape as the study) ═══ */
  const orr = $<SVGSVGElement>('.orr');
  const chipsEl = $<HTMLDivElement>('.chips');
  const factEl = $<HTMLDivElement>('.factcard');
  const scrub = $<HTMLInputElement>('.scrub');
  const nowbtn = $<HTMLButtonElement>('.nowbtn');
  const readEl = $<HTMLDivElement>('.readout');
  const clockDate = $<HTMLInputElement>('.clock-date');
  const clockNote = $<HTMLSpanElement>('.clock-note');

  const el = (n: string, at: Record<string, string | number>) => {
    const e = document.createElementNS(SVGNS, n);
    for (const k in at) e.setAttribute(k, String(at[k]));
    return e;
  };

  /* ═══ shared state — the study's ═══ */
  let liveAnchor: [number, number] | null = null;   // [tipHeight, ms] once the tip answers
  function anchors() {
    const a = ANCH.slice();
    if (liveAnchor && liveAnchor[0] > a[a.length - 1][0]) a.push(liveAnchor);
    return a;
  }
  function h2ms(h: number) {
    const a = anchors();
    if (h <= 0) return a[0][1] + h * 600000;
    for (let i = 0; i < a.length - 1; i++)
      if (h <= a[i + 1][0])
        return a[i][1] + (h - a[i][0]) * (a[i + 1][1] - a[i][1]) / (a[i + 1][0] - a[i][0]);
    const z = a[a.length - 1];
    return z[1] + (h - z[0]) * 600000;
  }
  function ms2h(ms: number) {
    const a = anchors();
    if (ms <= a[0][1]) return (ms - a[0][1]) / 600000;
    for (let i = 0; i < a.length - 1; i++)
      if (ms <= a[i + 1][1])
        return a[i][0] + (ms - a[i][1]) * (a[i + 1][0] - a[i][0]) / (a[i + 1][1] - a[i][1]);
    const z = a[a.length - 1];
    return z[0] + (ms - z[1]) / 600000;
  }
  const exactH = (h: number) => anchors().some(x => x[0] === h);
  function oldFmt(h: number) {
    const dt = new Date(h2ms(h));
    return (exactH(h) ? '' : '~') + String(dt.getUTCDate()).padStart(2, '0') + ' ' +
      MON3[dt.getUTCMonth()] + ' ' + dt.getUTCFullYear();
  }

  let tip = Math.floor(ms2h(Date.now()));     // honest fallback until the tip answers
  let tipEstimated = true;
  let tipSeen = Date.now();
  let tipTs: number | null = null;            // the tip block's CHAIN timestamp (s)
  let tipSrc: 'ship' | 'arcade' | null = null; // 'ship' | 'arcade' | null (~model)

  let mode: 'live' | 'scrub' | 'pick' = 'live';
  let pickH = 0;
  let sel: 'sun' | number = 'sun';            // which fact card is showing

  /* THE LADDER — this ship's own door FIRST: the same-origin seam
     /api/chain/tip?full=1 (node-first + public fallback SERVER-side; the
     CHAIN knob rewires every clock with zero client code). The arcade's
     time server second — time.pacsarcade.org, the house clock's own door,
     CORS open. The genesis-anchored ten-minute model last, wearing ~. */
  const DOORS: Array<{ url: string; src: 'ship' | 'arcade' }> = [
    { url: '/api/chain/tip?full=1', src: 'ship' },
    { url: 'https://time.pacsarcade.org/api/chain/tip?full=1', src: 'arcade' },
  ];
  /* THE SYNC LAW (owner report, 0018.04.17: "I watched it break on mempool
     and our time stayed the same"): every successful knock RE-ANCHORS the
     dial — height, chain timestamp, the live anchor — so a new block snaps
     the whole face within one poll breath. The cadence is 30 s (a block
     lands ~1 in 20 polls), and the wake listeners below re-knock the
     INSTANT the tab comes back — browsers suspend timers in hidden tabs,
     and the old 60 s-only loop left the face ticking on stale anchors
     ("its own time") after every tab switch. One transient dark poll no
     longer flips the dial to the ten-minute model either: the last REAL
     tip holds for a missed knock, and only a second straight miss admits
     the honest ~. */
  const POLL_MS = 30000;
  /* THE UNWEDGE LAW (owner report, 0018.05.01: "the time is getting stuck,
     i had to refresh it" — caught in the act by the stakeout): the old
     `inflight` boolean was a one-way trap. A fetch with no timeout can hang
     FOREVER (a request left half-open across a laptop sleep or a network
     change never settles), `finally` never runs, and every later poll AND
     every wake knock bounced off `if (inflight) return;` — the height froze
     until a hard refresh. Two cures, both required:
       1. every door knock carries a hard deadline (KNOCK_TIMEOUT_MS) so no
          fetch can out-live the poll that sent it;
       2. the guard is a TIMESTAMP, not a boolean — if a knock somehow still
          out-stays two poll breaths, the next knock walks past the corpse
          instead of waiting on it forever. */
  const KNOCK_TIMEOUT_MS = 10000;             // per-door deadline, well inside the 30 s cadence
  const INFLIGHT_STALE_MS = POLL_MS * 2;      // a knock older than this is presumed dead
  let inflightAt = 0;                         // 0 = no knock out; else Date.now() it left
  let knockSeq = 0;                           // stale knocks may not write state
  let misses = 0;                             // consecutive dark polls before the ~ takes over
  async function fetchTip() {
    if (inflightAt && Date.now() - inflightAt < INFLIGHT_STALE_MS) return;
    inflightAt = Date.now();
    const myKnock = ++knockSeq;
    let got: { h: number; ts: number | null; src: 'ship' | 'arcade' } | null = null;
    try {
      for (const door of DOORS) {
        if (got) break;
        try {
          const r = await fetch(door.url, {
            cache: 'no-store',
            signal: AbortSignal.timeout(KNOCK_TIMEOUT_MS),
          });
          const j = r.ok ? await r.json() : null;
          if (j && j.ok && Number.isFinite(j.height))
            got = {
              h: j.height,
              ts: Number.isFinite(j.tipTimestamp) ? j.tipTimestamp : null,
              src: door.src,
            };
        } catch { /* this rung is dark (or timed out) — the next one carries */ }
      }
    } finally {
      if (myKnock === knockSeq) inflightAt = 0;
    }
    if (destroyed || myKnock !== knockSeq) return;  // a newer knock owns the dial
    if (got) {
      misses = 0;
      if (got.h !== tip) tipSeen = Date.now();
      /* MINER-SKEW CLAMP (the strip clock's law, now here too): a tip
         timestamp from the future would pin blockAge() at 0 and freeze the
         seconds at :00 until the wall clock caught up — clamp to now. */
      tip = got.h;
      tipTs = got.ts != null ? Math.min(got.ts, Date.now() / 1000) : null;
      tipEstimated = false; tipSrc = got.src;
      liveAnchor = [tip, tipTs ? tipTs * 1000 : tipSeen];
    } else if (tipEstimated || ++misses >= 2) {
      /* truly dark (or never lit): the genesis-anchored model carries, ~ */
      tip = Math.floor(ms2h(Date.now())); tipEstimated = true; tipTs = null; tipSrc = null;
    }
    /* a single miss with a real tip in hand: hold the last true reading —
       the 30 s cadence knocks again before the face can drift a block */
    if (mode === 'live') scrub.value = String(tip);
    renderOrrery(); renderRead();
  }

  /* seconds into the current block — the CHAIN's own timestamp when the
     seam gives it (the honest age), first-seen wall clock otherwise */
  function blockAge() {
    if (tipEstimated) return (((ms2h(Date.now()) % 1) + 1) % 1) * 600;
    if (tipTs != null) return Math.max(Date.now() / 1000 - tipTs, 0);
    return (Date.now() - tipSeen) / 1000;
  }
  /* live fractional height: the tick fills in tenths, wearing the ~ */
  function liveH() {
    if (tipEstimated) return Math.max(ms2h(Date.now()), tip);
    return tip + Math.min(blockAge() / 600, 0.999);
  }

  /* ═══ THE RINGS — the hands ride the inner orbits and truly move; the
     chain's periods orbit beyond them. The order is the Admiral's ruling.
     ALL dots rest identical in the CREAM (the MOON keeps its phase face).
     ONE selection language, every ring: choose a ring and the ORANGE arc
     shows what's full, the BLUE arc what remains, and the dot lights
     GOLD — hidden at rest. The MOON
     rides its
     own orbit just outside the calendar's MONTH (synodic ≈ 4,252 blocks vs
     4,032 — the two-moons drift made visible; they kiss every ~19.3 bitcoin
     months, the house Metonic). Rings wear watchmaker tick marks — the
     Breguet/Patek graduation law. The moon is drawn as the NORTHERN sky
     sees it, and says so. ═══ */
  const RINGS: RingDef[] = [
    { key: 'SECOND', p: 60, r: 62, pr: 4.5, c: CREAM,
      fr: (H, a) => (capA(a) % 60) / 60,
      f: (H, a) => [`<b>60 SECONDS · 1/10 block</b>`, `:${faceTime(H, a).ss}`, `one lap a minute`, `the old world's second, kept`] },
    { key: 'MINUTE', p: 6, r: 77.6, pr: 4.5, c: CREAM,
      fr: (H, a) => (((bidOf(H) % 6) * 600 + capA(a)) % 3600) / 3600,
      f: (H, a) => { const t = faceTime(H, a); return [`<b>60 MINUTES · 6 blocks</b>`, `${t.hh}:${t.mm}`, `one lap an hour`, `the old world's hour, six strides`]; } },
    { key: 'HOUR', p: DAY, r: 93.3, pr: 5, c: CREAM, ticks: 24,
      fr: (H, a) => ((bidOf(H) * 600 + capA(a)) % 86400) / 86400,
      f: (H, a) => { const t = faceTime(H, a); return [`<b>24 HOURS · 144 blocks</b>`, `${t.hh}:${t.mm}:${t.ss}`, `one lap fills the day`, `the old world's day, kept whole`]; } },
    /* BLOCK counts the way the Admiral reads it: block x of 144, one lap
       fills the day, full at the top — the day's 24 hour-marks on the rim */
    { key: 'BLOCK', p: DAY, r: 108.9, pr: 5.5, c: CREAM, ticks: 24,
      fr: (H, a) => (bidOf(H) + capA(a) / 600) / DAY,
      f: H => [`<b>BLOCK · 144 a day, ~10 min each</b>`, `block ${bidOf(H) + 1} of 144`, `one lap fills the day`, `the old world's ten minutes`] },
    /* the calendar rings count the way the Admiral reads a clock: the DAY
       dot climbs 1→28 and its lap FILLS the month — full lands at the top,
       and the new month begins there. MONTH climbs 1→13 filling the year;
       YEAR wears bitcoin's age and laps the 13-year animal wheel. */
    { key: 'DAY', p: MONTH, r: 124.5, pr: 5, c: CREAM, ticks: 28,
      fr: H => pmod(H, MONTH) / MONTH,
      f: H => [`<b>28 DAYS · 4,032 blocks</b>`, `day ${Math.floor(pmod(H, MONTH) / DAY) + 1} of 28 — full at the top`, `one lap fills the month`, `the old world's month, made even`] },
    /* THE WEEK (v27): 1,008 blocks = 7 block-days. The dot reads week 1–4
       of the month and its lap FILLS the month, DAY's own counting law —
       a month is exactly four weeks: no ragged weeks, ever. 4 ticks. */
    { key: 'WEEK', p: MONTH, r: 140.2, pr: 5, c: CREAM, ticks: 4,
      fr: H => pmod(H, MONTH) / MONTH,
      f: H => [`<b>4 WEEKS · 1,008 blocks each</b>`, `week ${Math.floor(pmod(H, MONTH) / WEEK) + 1} of 4`, `one lap fills the month`, `the old world's week`, `no ragged weeks, ever`] },
    { key: 'FORTNIGHT', p: DIFF, r: 155.8, pr: 5, c: CREAM,
      f: H => [`<b>FORTNIGHT · 2,016 blocks</b>`, `${pct(H, DIFF)} through`, `the difficulty re-tunes each lap`, `the old world's two weeks`] },
    { key: 'MONTH', p: YEAR, r: 171.5, pr: 5, c: CREAM, ticks: 13,
      fr: H => pmod(H, YEAR) / YEAR,
      f: H => { const h = houseOf(pmod(H, YEAR) / YEAR);
        return [`<b>13 MONTHS · 52,416 blocks</b>`, `month ${Math.floor(pmod(H, YEAR) / MONTH) + 1} of 13`, `one lap fills the year`, `house of ${h[0]} ${h[1]}`]; } },
    { key: 'MOON', p: 4252, r: 187.1, pr: 6, c: CREAM, moon: true,
      fr: H => moonFracAt(mode === 'live' ? Date.now() : h2ms(H)),
      f: H => { const t = mode === 'live' ? Date.now() : h2ms(H); const m = moonAt(t); const h = houseOf(moonFracAt(t));
        return [`<b>MOON · ≈4,252 blocks</b>`, `${m[0]} ${m[1]}`, `house of ${h[0]} ${h[1]}`, `the northern sky's view`]; } },
    { key: 'YEAR', p: YEAR * 13, r: 202.7, pr: 5.5, c: CREAM, ticks: 13,
      fr: H => (pmod(Math.floor(H / YEAR), 13) + pmod(H, YEAR) / YEAR) / 13,
      f: H => { const bd = bftDate(H), an = yearAnimal(bd);
        return [`<b>YEAR · 52,416 blocks</b>`, `year ${bd.y} — bitcoin's age`, `one lap, the 13-animal wheel`, `${an[0]} ${an[1]}`]; } },
    /* OLYMPIAD (v27 rename — the ring formerly labeled HALVING): the dot
       still counts halvings-so-far; its lap is the ~4-year epoch, and the
       NEXT halving lands at the top — the counting law, gold on selection */
    { key: 'OLYMPIAD', p: HALV, r: 218.4, pr: 6, c: CREAM, ticks: 4,
      f: H => [`<b>OLYMPIAD · 210,000 blocks</b>`, `≈ 4 years`, `${Math.max(0, Math.floor(H / HALV))} halvings so far`, `the subsidy folds at the top`, `the old world counted games by it`] },
    { key: 'GENERATION', p: CYCLE, r: 234, pr: 5.5, c: CREAM, ticks: 6,
      f: H => [`<b>GENERATION · 1,260,000 blocks</b>`, `halving ${Math.floor(pmod(H, CYCLE) / HALV) + 1} of 6`, `≈24 years — a human generation`, `Saturn returns ≈1.55M`] },
    { key: 'LAST SAT', p: LAST, r: 258, pr: 5, c: CREAM, arc: true,
      f: H => [`<b>LAST SAT · 6,930,000 blocks</b>`, `${(H / LAST * 100).toFixed(2)}% along`, `genesis → the last sat struck`, `the old world's ~2140`] },
  ];

  /* every dot carries its READING — glance at the planet, know the value,
     the way a clock hand points at its number */
  const NUMS: Record<string, (H: number, a: number) => string> = {
    SECOND: (H, a) => faceTime(H, a).ss,
    MINUTE: (H, a) => faceTime(H, a).mm,
    BLOCK: H => String(bidOf(H) + 1),                           // block 1-144, fills the day
    HOUR: (H, a) => faceTime(H, a).hh,
    DAY: H => String(Math.floor(pmod(H, MONTH) / DAY) + 1),     // day 1-28, fills the month
    WEEK: H => String(Math.floor(pmod(H, MONTH) / WEEK) + 1),   // week 1-4, fills the month
    FORTNIGHT: H => String(Math.floor(pmod(H, DIFF) / DIFF * 100)), // % to the re-tune fortnight
    MONTH: H => String(Math.floor(pmod(H, YEAR) / MONTH) + 1),  // month 1-13, fills the year
    YEAR: H => String(bftDate(H).y),                            // bitcoin's age (mirrored b₿)
    OLYMPIAD: H => String(Math.max(0, Math.floor(H / HALV))),   // halvings so far
    GENERATION: H => String(Math.floor(pmod(H, CYCLE) / HALV) + 1), // halving 1-6 of the generation
    'LAST SAT': H => Math.max(0, Math.round(H / LAST * 100)) + '%',
  };
  RINGS.forEach(r => { r.n = NUMS[r.key]; });

  /* the ruled radii — BAND/OFF restore these exactly; the wanderers
     share the sky band. radiusOf(key, mode) is the ONE radius law. */
  const HOMER: Record<string, number> = {};
  RINGS.forEach(r => { HOMER[r.key] = r.r; });
  WANDER.forEach(w => { HOMER[w.name] = SKY_R; });   // BAND: all six share the sky band
  const radiusOf = (key: string, lay: 'rings' | 'home') =>
    lay === 'rings' ? KEPLER[key] : HOMER[key];
  let planetMode: 'band' | 'rings' | 'off' = 'band';

  /* ═══ build — the study's buildOrrery, ids made instance-unique ═══ */
  const planets: Planet[] = [];
  let wedgeIdx = -1;
  let sunLbl: SVGTextElement, sunTime: SVGTextElement, sunDate: SVGTextElement,
    sunVel: SVGTextElement, zodiacG: SVGGElement, sunTT: SVGTitleElement,
    houseWedge: SVGPathElement, skyG: SVGGElement, skyBand: SVGCircleElement;
  const wanderers: { g: SVGGElement; tt: SVGTitleElement; w: Wanderer;
    orb: SVGCircleElement; cr: number; hi: number }[] = [];
  while (orr.firstChild) orr.removeChild(orr.firstChild); // idempotent (strict-mode remount)
  {
    /* the gravity well — the sun's pull, fading out through the rings,
       wearing the same 624 ember as the sun itself */
    const defs = el('defs', {});
    defs.innerHTML = '<radialGradient id="' + uid + '-gw">' +
      '<stop offset="0%" stop-color="#ff6600" stop-opacity=".17"/>' +
      '<stop offset="35%" stop-color="#ff6600" stop-opacity=".05"/>' +
      '<stop offset="100%" stop-color="#ff6600" stop-opacity="0"/></radialGradient>' +
      '<clipPath id="' + uid + '-mcl"><circle r="6"/></clipPath>' +
      '<clipPath id="' + uid + '-jcl"><circle r="6"/></clipPath>';
    orr.appendChild(defs);
    orr.appendChild(el('circle', { r: 285, fill: 'url(#' + uid + '-gw)' }));
    /* THE 13 HOUSES — faint spokes from the sun's edge to beyond the last
       orbit, one per bitcoin month, sign glyphs on the outer rim. An
       experiment layer: the ✶ HOUSES chip lights and douses it. */
    zodiacG = el('g', {}) as SVGGElement;
    /* the house shade — the current month's wedge, softly lit so the whole
       pie slice (and its boundaries) reads at a glance */
    houseWedge = el('path', { fill: 'rgba(255,102,0,.055)', stroke: 'rgba(242,234,216,.10)', 'stroke-width': 1 }) as SVGPathElement;
    zodiacG.appendChild(houseWedge);
    /* the sign NAMES arc on the rim under their glyphs, above the outermost
       ring line — watch-dial law: two invisible circle tracks, one clockwise
       for the upper rim, one counter-clockwise for the lower rim so every
       name reads upright. Both live in zodiacG: ✶ HOUSES douses them too. */
    const nameTrack = (id: string, r: number, sweep: number) => el('path', { id, fill: 'none',
      d: 'M ' + r + ' 0 A ' + r + ' ' + r + ' 0 1 ' + sweep + ' -' + r + ' 0 A ' + r + ' ' + r + ' 0 1 ' + sweep + ' ' + r + ' 0' });
    zodiacG.appendChild(nameTrack(uid + '-znT', 264, 1));    // upper rim — text body arcs outward
    zodiacG.appendChild(nameTrack(uid + '-znB', 270.5, 0));  // lower rim — text body arcs inward
    for (let k = 0; k < 13; k++) {
      const ba = k / 13 * 2 * Math.PI - Math.PI / 2;              // sector boundary
      zodiacG.appendChild(el('line', {
        x1: (58 * Math.cos(ba)).toFixed(1), y1: (58 * Math.sin(ba)).toFixed(1),
        x2: (272 * Math.cos(ba)).toFixed(1), y2: (272 * Math.sin(ba)).toFixed(1),
        stroke: 'rgba(242,234,216,.08)', 'stroke-width': 1, 'stroke-dasharray': '3 5' }));
      const ca = (k + .5) / 13 * 2 * Math.PI - Math.PI / 2;       // sector center
      const gl = el('text', { x: (281 * Math.cos(ca)).toFixed(1), y: (281 * Math.sin(ca)).toFixed(1),
        'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 12,
        fill: 'rgba(242,234,216,.6)', cursor: 'default' });
      gl.textContent = ZOD13[k][0] + '︎';   // text presentation — ⛎ renders as emoji otherwise and ignores the paint
      const gt = el('title', {});
      gt.textContent = ZOD13[k][1] + ' — house ' + (k + 1) + ' of 13 · month ' + String(k + 1).padStart(2, '0') + '’s seat';
      gl.appendChild(gt);
      zodiacG.appendChild(gl);
      /* the name, curved under the glyph — flip to the CCW track when the
         sector center rides the lower rim, so the word stays upright */
      const low = Math.sin(ca) > 0;
      const off = (pmod(low ? -ca : ca, 2 * Math.PI) / (2 * Math.PI) * 100).toFixed(2) + '%';
      const nm = el('text', { class: 'rimname', 'text-anchor': 'middle' });
      const ntp = el('textPath', { startOffset: off });
      const track = '#' + uid + (low ? '-znB' : '-znT');
      ntp.setAttribute('href', track);
      ntp.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', track);
      ntp.textContent = ZOD13[k][1].toUpperCase();
      nm.appendChild(ntp);
      const nt = el('title', {});
      nt.textContent = ZOD13[k][1] + ' — house ' + (k + 1) + ' of 13 · month ' + String(k + 1).padStart(2, '0') + '’s seat';
      nm.appendChild(nt);
      zodiacG.appendChild(nm);
    }
    orr.appendChild(zodiacG);
    RINGS.forEach((rg, i) => {
      const ring = el('circle', { class: 'ring', r: rg.r, 'data-i': i }) as SVGCircleElement;
      orr.appendChild(ring);
      /* the thumb band — tap anywhere ON the orbit line to choose the ring
         (a 1.25px stroke was never a touch target). It rides low in the
         z-order, right on its ring, so every dot's hit circle stays boss. */
      const bandHit = el('circle', { class: 'ringhit', r: rg.r, 'data-i': i }) as SVGCircleElement;
      orr.appendChild(bandHit);
      /* watchmaker graduations — the Breguet/Patek tick-mark law; the
         refs ride along so applyLayout() can re-seat them per radius */
      const tickEls: SVGLineElement[] = [];
      if (rg.ticks) {
        for (let k = 0; k < rg.ticks; k++) {
          const ta = k / rg.ticks * 2 * Math.PI - Math.PI / 2;
          const ln = el('line', {
            x1: ((rg.r - 2.5) * Math.cos(ta)).toFixed(2), y1: ((rg.r - 2.5) * Math.sin(ta)).toFixed(2),
            x2: ((rg.r + 2.5) * Math.cos(ta)).toFixed(2), y2: ((rg.r + 2.5) * Math.sin(ta)).toFixed(2),
            stroke: 'rgba(242,234,216,.22)', 'stroke-width': 1 }) as SVGLineElement;
          orr.appendChild(ln); tickEls.push(ln);
        }
      }
      /* the orbit line carries its own name — read the ring like a dial */
      const pid = uid + '-rp' + i;
      const lblPath = el('path', { id: pid, fill: 'none',
        d: 'M ' + rg.r + ' 0 A ' + rg.r + ' ' + rg.r + ' 0 1 1 -' + rg.r + ' 0 A ' + rg.r + ' ' + rg.r + ' 0 1 1 ' + rg.r + ' 0' }) as SVGPathElement;
      orr.appendChild(lblPath);
      const lb = el('text', { class: 'ringlbl' });
      const tp = el('textPath', { startOffset: '61%' });
      tp.setAttribute('href', '#' + pid);
      tp.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + pid);
      tp.textContent = rg.key;
      lb.appendChild(tp); orr.appendChild(lb);

      /* ONE selection language, every ring: choose a ring and the ORANGE arc
         shows what's full, the BLUE arc shows what remains — hidden at rest */
      const fillA = el('circle', { r: rg.r, fill: 'none', stroke: '#ff6600', 'stroke-width': 2.2,
        pathLength: 100, 'stroke-dasharray': '0 100', transform: 'rotate(-90)',
        'stroke-linecap': 'round', opacity: 0 }) as SVGCircleElement;
      const remA = el('circle', { r: rg.r, fill: 'none', stroke: CYAN, 'stroke-width': 1.5,
        pathLength: 100, 'stroke-dasharray': '0 100', transform: 'rotate(-90)',
        'stroke-linecap': 'round', opacity: 0 }) as SVGCircleElement;
      orr.appendChild(fillA); orr.appendChild(remA);
      /* the MOON is drawn at its true phase — dark disc, lit overlay sliding
         with the synodic age (as the NORTHERN sky sees it: waxing lights the
         right limb) */
      let pl: SVGGElement, lit: SVGCircleElement | null = null, num: SVGTextElement | null = null,
        dot: SVGCircleElement | null = null;
      if (rg.moon) {
        pl = el('g', {}) as SVGGElement;
        pl.appendChild(el('circle', { r: 6, fill: '#23232a', stroke: 'rgba(242,234,216,.4)', 'stroke-width': '.7' }));
        lit = el('circle', { r: 6, fill: '#d9d3c6', 'clip-path': 'url(#' + uid + '-mcl)' }) as SVGCircleElement;
        pl.appendChild(lit);
      } else {
        /* the dot is a tiny dial: the planet circle with its reading inside.
           ALL dots rest identical (cream); the chosen ring's dot lights
           GOLD (owner ruling: like the halving's, fleet-wide) */
        pl = el('g', {}) as SVGGElement;
        dot = el('circle', { r: 8, fill: rg.c }) as SVGCircleElement;
        pl.appendChild(dot);
        num = el('text', { y: 2.4, 'text-anchor': 'middle', 'font-size': 6.5, 'font-weight': '700', fill: '#121215' }) as SVGTextElement;
        pl.appendChild(num);
      }
      const hit = el('circle', { class: 'hit', r: 17, 'data-i': i }) as SVGCircleElement;
      const tt = el('title', {}) as SVGTitleElement; hit.appendChild(tt);   // native hover tooltip
      orr.appendChild(pl); orr.appendChild(hit);
      planets.push({ pl, lit, num, hit, ring, rg, fillA, remA, dot, tt, lblPath, tickEls, cr: rg.r, bandHit });
    });
    /* THE WANDERERS' SKY BAND — one faint dashed circle between GENERATION
       and LAST SAT; the six classical planets ride it at ~mean longitude.
       Tiny true-color bodies: lawful house-art, the one place the study
       wears the planets' own colors. */
    skyG = el('g', {}) as SVGGElement;
    skyBand = el('circle', { r: SKY_R, fill: 'none', stroke: 'rgba(242,234,216,.10)',
      'stroke-width': 1, 'stroke-dasharray': '2 6' }) as SVGCircleElement;
    skyG.appendChild(skyBand);
    WANDER.forEach(w => {
      /* in RINGS state each wanderer rides its OWN faint dashed orbit at its
         lap-period radius — hidden while the shared band rules */
      const orb = el('circle', { r: KEPLER[w.name], fill: 'none',
        stroke: 'rgba(242,234,216,.08)', 'stroke-width': 1, 'stroke-dasharray': '2 6' }) as SVGCircleElement;
      orb.style.display = 'none';
      skyG.appendChild(orb);
      const g = el('g', {}) as SVGGElement;
      if (w.name === 'MERCURY') {
        g.appendChild(el('circle', { r: 3, fill: '#a8a49c' }));
      } else if (w.name === 'VENUS') {
        g.appendChild(el('circle', { r: 4, fill: '#e2cf9a' }));
      } else if (w.name === 'EARTH') {
        g.appendChild(el('circle', { r: 4, fill: '#6fa0ad' }));
        g.appendChild(el('circle', { cx: -1.1, cy: .6, r: 1.6, fill: 'rgba(140,180,120,.7)' }));
      } else if (w.name === 'MARS') {
        g.appendChild(el('circle', { r: 3.5, fill: '#b06a48' }));
      } else if (w.name === 'JUPITER') {
        g.appendChild(el('circle', { r: 6, fill: '#cdb08a' }));
        const bands = el('g', { 'clip-path': 'url(#' + uid + '-jcl)' });
        bands.appendChild(el('rect', { x: -6, y: -2.6, width: 12, height: 1.5, fill: '#a5825f' }));
        bands.appendChild(el('rect', { x: -6, y: .8, width: 12, height: 1.8, fill: '#a5825f' }));
        g.appendChild(bands);
      } else if (w.name === 'SATURN') {
        g.appendChild(el('circle', { r: 5, fill: '#d6c290' }));
        g.appendChild(el('ellipse', { rx: 9, ry: 2.6, fill: 'none', stroke: '#b3a077',
          'stroke-width': 1, transform: 'rotate(-18)' }));
      }
      const sy = el('text', { y: -11, 'text-anchor': 'middle', 'font-size': 7,
        fill: 'rgba(242,234,216,.55)' });
      sy.textContent = w.sym + '︎';   // text presentation — ♀♂ go emoji otherwise
      g.appendChild(sy);
      const hov = el('circle', { r: 12, fill: 'transparent' });
      const wtt = el('title', {}) as SVGTitleElement;
      hov.appendChild(wtt); g.appendChild(hov);
      skyG.appendChild(g);
      wanderers.push({ g, tt: wtt, w, orb, cr: SKY_R, hi: -1 });
    });
    orr.appendChild(skyG);
    /* the sun: TIME CLOSEST TO THE HEART — hh:mm:ss beating at the center,
       the height beneath it as the sun's velocity (one block of speed every
       ~10 min), the planets held in the well of its pull. The sun wears the
       624 EMBER — vivid tangerine, the protocol's own 624 nm light — and
       THE 624 PULSE breathes it from the brand coin-orange to the ember. */
    orr.appendChild(el('circle', { r: 58, fill: BTC, opacity: .4, class: 'sunpulse sun624' }));
    orr.appendChild(el('circle', { r: 50, fill: BTC, class: 'sun624' }));
    sunLbl = el('text', { y: -27, 'text-anchor': 'middle', 'font-size': 6.2, 'letter-spacing': '.22em', fill: '#121215', opacity: .72 }) as SVGTextElement;
    sunLbl.textContent = 'BITCOIN TIME';
    /* the classed three step their font up on phone-scale decks (CSS
       @media ≤480px overrides these attribute sizes) — the face must
       read at arm's length even when the whole dial is ~300px wide */
    sunTime = el('text', { class: 'suntime', y: -5, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': '700', fill: '#121215' }) as SVGTextElement;
    sunDate = el('text', { class: 'sundate', y: 11, 'text-anchor': 'middle', 'font-size': 7.5, fill: '#121215', opacity: .85 }) as SVGTextElement;
    sunVel = el('text', { class: 'sunvel', y: 27, 'text-anchor': 'middle', 'font-size': 7, 'font-weight': '700', 'letter-spacing': '.06em', fill: '#121215', opacity: .72 }) as SVGTextElement;
    const sunHit = el('circle', { class: 'hit', r: 58, 'data-i': 'sun' }) as SVGCircleElement;
    sunTT = el('title', {}) as SVGTitleElement; sunHit.appendChild(sunTT);
    [sunLbl, sunTime, sunDate, sunVel, sunHit].forEach(n => orr.appendChild(n));
    planets.push({ hit: sunHit });
  }

  function curH() { return mode === 'live' ? liveH() : mode === 'pick' ? pickH : +scrub.value; }

  function renderOrrery(withText?: boolean) {
    const H = curH();
    const age = mode === 'live' ? blockAge() : 0;
    planets.forEach(o => {
      if (!o.rg) return;
      const frac = o.rg.arc ? Math.min(Math.max(H, 0) / LAST, 1)
        : o.rg.fr ? pmod(o.rg.fr(H, age), 1)
        : pmod(H, o.rg.p) / o.rg.p;
      const a = frac * 2 * Math.PI - Math.PI / 2;
      const x = (o.cr! * Math.cos(a)).toFixed(2), y = (o.cr! * Math.sin(a)).toFixed(2);
      o.pl!.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
      if (o.rg.moon) {
        /* phase = position on this orbit: the lit disc slides across the dark
           one — off-right at new, centered at full, off-left back to new */
        const off = frac <= .5 ? 12 * (1 - 2 * frac) : -12 * (2 * frac - 1);
        o.lit!.setAttribute('cx', off.toFixed(2));
      }
      if (o.num && o.rg.n) o.num.textContent = o.rg.n(H, age);
      o.hit.setAttribute('cx', x); o.hit.setAttribute('cy', y);
      if (o.fillA) {
        const chosen = sel === planets.indexOf(o);
        /* the chosen ring's dot lights GOLD — the one selection color for
           every dot (owner ruling: like the halving's, fleet-wide) */
        if (o.dot) o.dot.setAttribute('fill', chosen ? GOLD : o.rg.c);
        if (chosen) {
          o.fillA.setAttribute('stroke-dasharray', (frac * 100).toFixed(2) + ' 100');
          o.fillA.setAttribute('opacity', '.8');
          o.remA!.setAttribute('stroke-dasharray', ((1 - frac) * 100).toFixed(2) + ' 100');
          o.remA!.setAttribute('stroke-dashoffset', (-frac * 100).toFixed(2));
          o.remA!.setAttribute('opacity', '.4');
        } else {
          o.fillA.setAttribute('opacity', '0');
          o.remA!.setAttribute('opacity', '0');
        }
      }
    });
    renderWander(H);
    renderSun(H);
    /* shade the month's current house wedge (recut only when it moves) */
    const wk = Math.floor(pmod(H, YEAR) / MONTH) % 13;
    if (wk !== wedgeIdx) { wedgeIdx = wk; houseWedge.setAttribute('d', wedgePath(wk)); }
    if (withText !== false) renderFact(H);
  }
  /* the wanderers ride the clock: scrub or pick a date and the sky follows.
     Position every frame; the tooltip recuts only when the house changes. */
  function renderWander(H: number) {
    const ms = mode === 'live' ? Date.now() : h2ms(H);
    wanderers.forEach(o => {
      const f = wanderFrac(o.w, ms), a = f * 2 * Math.PI - Math.PI / 2;
      o.g.setAttribute('transform',
        'translate(' + (o.cr * Math.cos(a)).toFixed(2) + ' ' + (o.cr * Math.sin(a)).toFixed(2) + ')');
      const hk = Math.floor(pmod(f, 1) * 13) % 13;
      if (hk !== o.hi) {
        o.hi = hk;
        const h = ZOD13[hk];
        o.tt.textContent = o.w.name + ' ' + o.w.sym + (o.w.note ? ' — ' + o.w.note : '') +
          ' · lap ' + o.w.lap + ' · ' + o.w.old +
          ' · in the house of ' + h[0] + ' ' + h[1] + ' · ~mean longitude';
      }
    });
  }
  function wedgePath(k: number) {
    const a0 = k / 13 * 2 * Math.PI - Math.PI / 2, a1 = (k + 1) / 13 * 2 * Math.PI - Math.PI / 2;
    const r1 = 58, r2 = 272;
    const P = (r: number, a: number) => (r * Math.cos(a)).toFixed(1) + ' ' + (r * Math.sin(a)).toFixed(1);
    return 'M ' + P(r1, a0) + ' L ' + P(r2, a0) + ' A ' + r2 + ' ' + r2 + ' 0 0 1 ' + P(r2, a1) +
      ' L ' + P(r1, a1) + ' A ' + r1 + ' ' + r1 + ' 0 0 0 ' + P(r1, a0) + ' Z';
  }
  function renderSun(H?: number) {
    H = H === undefined ? Math.max(curH(), 0) : H;
    const live = mode === 'live';
    const t = faceTime(H, live ? blockAge() : 0);
    const est = live && tipEstimated;
    sunTime.textContent = t.hh + ':' + t.mm + ':' + t.ss + (est ? '~' : '');
    sunTime.classList.toggle('strain', live && t.strain);
    sunDate.textContent = bftDate(H).str;
    sunVel.textContent = '★ ' + (est ? '~' : '') + (H < 0 ? '−' : '') + nf(Math.floor(H));
  }
  /* THE WRAP LAW (v27): the card is a row of atomic segments — each one an
     inline-block/nowrap span, the ' ·' separator bound to the TAIL of the
     segment before it, so a wrapped line can never open with '·' and no
     segment ever breaks inside itself. */
  const segJoin = (a: string[]) =>
    a.map((s, i) => '<span class="seg">' + s + (i < a.length - 1 ? ' ·' : '') + '</span>').join(' ');
  function renderFact(H?: number) {
    H = H === undefined ? curH() : H;
    /* hover text everywhere — every hit target carries its fact as a native
       tooltip, same words as the card at the bottom */
    const age = mode === 'live' ? blockAge() : 0;
    planets.forEach(o => {
      if (o.tt && o.rg) o.tt.textContent = (o.rg.f(H!, age).join(' · ') +
        (planetMode === 'rings' && KISS[o.rg.key] ? ' · ' + KISS[o.rg.key] : '')).replace(/<[^>]*>/g, '');
    });
    if (sunTT) sunTT.textContent = 'THE LIGHT · block ' + (H < 0 ? '−' : '') + nf(Math.floor(H)) + ' · ' + bftDate(H).str + ' · one block of velocity every ~10 min';
    let segs: string[];
    if (sel === 'sun') {
      segs = [`<b>THE LIGHT · block ${H < 0 ? '−' : ''}${nf(Math.floor(H))}</b>`,
        'the sun of this system', 'b₿ and a₿ turn around it', 'one block of speed every ~10 min'];
      if (mode === 'live' && tipEstimated) segs.push('<span class="tilde">~estimated</span>');
    } else {
      const o = planets[sel as number], age2 = mode === 'live' ? blockAge() : 0;
      const frac = o.rg!.arc ? Math.min(Math.max(H!, 0) / LAST, 1) : o.rg!.fr ? pmod(o.rg!.fr(H!, age2), 1) : pmod(H!, o.rg!.p) / o.rg!.p;
      segs = o.rg!.f(H!, age2).slice();
      if (planetMode === 'rings' && KISS[o.rg!.key]) segs.push(KISS[o.rg!.key]);
      segs.push(`<span class="tilde">${(100 - frac * 100).toFixed(frac > .99 ? 1 : 0)}% to go</span>`);
    }
    factEl.innerHTML = '<span class="fwrap">' + segJoin(segs) + '</span>';
    /* only the RING chips carry the selection — the study's data-sel
       scoping law: the ✶ HOUSES / ☿ PLANETS toggles and the ≡ expander
       keep their own light (a class-exclusion sweep would douse every NEW
       toggle it forgot to name; data-sel marks exactly the chips that
       carry a selection) */
    root.querySelectorAll('.chips .pchip[data-sel]').forEach((b, i) => {
      const on = sel === 'sun' ? i === 0 : i === (sel as number) + 1;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  function renderRead() {
    const H = Math.floor(curH());
    const live = mode === 'live';
    readEl.innerHTML =
      `${H < 0 ? nf(H) + ' blocks before genesis' : 'block ' + nf(H)} · ${oldFmt(H)} · ${bftDate(H).str}` +
      (live ? (tipEstimated ? ' · <span class="tilde">~no rail, ten-minute model</span>'
          : tipSrc === 'ship' ? ' · live · this ship’s door'
          : ' · live · the arcade’s time server')
        : mode === 'pick' ? ' · set by the date picker — NOW returns'
        : ' · scrubbing — NOW returns');
  }

  /* every listener rides one leash — destroy() aborts them all */
  const ac = new AbortController();
  const sig = { signal: ac.signal };

  /* ═══ THE PLANET SELECTOR — the chips column reborn as planets (owner
     order: "maybe all of these type of items become planets — lean into
     the planet theme", + "i would like to see the left items be
     collapsible"). COLLAPSED (the default): a slim string of planet
     dots — THE LIGHT a small ember-pulsing sun, every ring a planet in
     the resting cream, the MOON her current phase disc, ✶ HOUSES a tiny
     star — each wearing its name as a native tooltip and aria-label.
     The ≡ handle expands the string into the full labeled chips (dot +
     name side by side); ‹ collapses it back to dots. Clicking a planet
     selects its ring exactly as before, and the chosen planet lights
     GOLD — the one selection law, same as the dial. On small decks the
     collapsed string rides horizontally under the dial. ═══ */
  while (chipsEl.firstChild) chipsEl.removeChild(chipsEl.firstChild); // idempotent (strict-mode remount)
  const expander = document.createElement('button');
  expander.type = 'button';
  expander.className = 'chips-toggle';
  const setExpanded = (open: boolean) => {
    chipsEl.classList.toggle('collapsed', !open);
    expander.textContent = open ? '‹' : '≡';
    expander.setAttribute('aria-expanded', String(open));
    expander.setAttribute('aria-label', open ? 'collapse the planet list to dots' : 'expand the planet list to show names');
    expander.title = open ? 'collapse' : 'planet names';
  };
  expander.addEventListener('click', () => setExpanded(chipsEl.classList.contains('collapsed')), sig);
  setExpanded(false);   // dots first — the dial is the lesson, the list steps back
  chipsEl.appendChild(expander);
  /* every chip wears its own little planet — DETERMINISTIC per ring (the
     study's .pdot set, not random): varied muted colors, one banded, one
     ringed, one spotted. THE LIGHT keeps the pulsing ember sun, the MOON
     keeps her phase. Selection lights the body GOLD via CSS (.on .pb /
     .pbs) — subtle: instrument, not toy box. */
  function chipDot(key: string) {
    const s = '<svg viewBox="0 0 12 12" aria-hidden="true">', e = '</svg>';
    switch (key) {
      case 'THE LIGHT':   // the ember sun, still breathing
        return s + '<circle cx="6" cy="6" r="4.2" fill="#ff6600" class="sun624"/>' + e;
      case 'SECOND':      // bare rock, mercury-small
        return s + '<circle cx="6" cy="6" r="2.4" class="pb" fill="#a8a49c"/>' + e;
      case 'MINUTE':      // pale-gold veil
        return s + '<circle cx="6" cy="6" r="3" class="pb" fill="#dcc892"/>' + e;
      case 'HOUR':        // sea and a hint of land
        return s + '<circle cx="6" cy="6" r="3.2" class="pb" fill="#7ca9a4"/>' +
          '<circle cx="5.1" cy="5.4" r="1.1" fill="rgba(140,180,120,.6)"/>' + e;
      case 'BLOCK':       // the banded giant
        return s + '<circle cx="6" cy="6" r="3.6" class="pb" fill="#c2a47c"/>' +
          '<rect x="2.9" y="4.5" width="6.2" height="1" fill="rgba(90,68,48,.5)"/>' +
          '<rect x="3.1" y="6.7" width="5.8" height="1.2" fill="rgba(90,68,48,.38)"/>' + e;
      case 'DAY':         // the ringed one
        return s + '<ellipse cx="6" cy="6" rx="5.3" ry="1.7" fill="none" stroke="#b3a077" stroke-width=".9" class="pbs" transform="rotate(-18 6 6)"/>' +
          '<circle cx="6" cy="6" r="2.7" class="pb" fill="#d6c290"/>' + e;
      case 'WEEK':        // the quartered worldlet — four even weeks
        return s + '<circle cx="6" cy="6" r="3" class="pb" fill="#c9b58e"/>' +
          '<path d="M6 3v6M3 6h6" stroke="rgba(28,28,38,.35)" stroke-width=".7" fill="none"/>' + e;
      case 'FORTNIGHT':  // the spotted moonlet
        return s + '<circle cx="6" cy="6" r="3.2" class="pb" fill="#9aa0a8"/>' +
          '<circle cx="5" cy="5.1" r=".8" fill="rgba(28,28,38,.42)"/>' +
          '<circle cx="7.3" cy="7" r=".55" fill="rgba(28,28,38,.36)"/>' + e;
      case 'MONTH':       // dusty olive
        return s + '<circle cx="6" cy="6" r="3" class="pb" fill="#a8a878"/>' + e;
      case 'MOON': {      // her true phase, as the northern sky sees it
        const f = moonFracAt(Date.now());
        const off = (f <= .5 ? 6.4 * (1 - 2 * f) : -6.4 * (2 * f - 1)).toFixed(2);
        return s + '<clipPath id="' + uid + '-mchip"><circle cx="6" cy="6" r="3.2"/></clipPath>' +
          '<circle cx="6" cy="6" r="3.2" fill="#23232a" stroke="rgba(242,234,216,.5)" stroke-width=".6" class="pbs"/>' +
          '<circle cx="' + (6 + +off) + '" cy="6" r="3.2" fill="#d9d3c6" clip-path="url(#' + uid + '-mchip)"/>' + e;
      }
      case 'YEAR':        // far dusty blue
        return s + '<circle cx="6" cy="6" r="3.4" class="pb" fill="#7c93b5"/>' + e;
      case 'OLYMPIAD':    // pale ice-cyan (gold when chosen — money's ring)
        return s + '<circle cx="6" cy="6" r="3.4" class="pb" fill="#8fbfbf"/>' + e;
      case 'GENERATION':  // muted violet, one faint band
        return s + '<circle cx="6" cy="6" r="3.2" class="pb" fill="#9a8ab0"/>' +
          '<rect x="3.3" y="5.5" width="5.4" height=".9" fill="rgba(50,40,70,.4)"/>' + e;
      case 'LAST SAT':    // the far dim wanderer, thin halo
        return s + '<circle cx="6" cy="6" r="4.6" fill="none" stroke="rgba(242,234,216,.22)" stroke-width=".7"/>' +
          '<circle cx="6" cy="6" r="2.6" class="pb" fill="#8a8578"/>' + e;
      default: return s + '<circle cx="6" cy="6" r="3" class="pb" fill="#a8a49c"/>' + e;
    }
  }
  ['THE LIGHT', ...RINGS.map(r => r.key)].forEach((name, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pchip' + (i === 0 ? ' pchip-sun' : '');
    b.dataset.sel = String(i);   // selection chips only — the toggles keep their own light
    b.title = name;
    b.setAttribute('aria-label', 'select ' + name);
    const dot = document.createElement('span');
    dot.className = 'pdot';
    dot.setAttribute('aria-hidden', 'true');
    dot.innerHTML = chipDot(name);   // the collapsed dot IS the planet art
    const lbl = document.createElement('span');
    lbl.className = 'plabel';
    lbl.textContent = name;
    b.append(dot, lbl);
    b.addEventListener('click', () => { sel = i === 0 ? 'sun' : i - 1; hotRing(); renderFact(); }, sig);
    chipsEl.appendChild(b);
  });
  /* the experiment switch — the 13 houses, lit by default, doused on tap;
     its planet is a tiny star. A LAYER toggle, not a ring selection — it
     keeps cyan for "lit", never the selection gold. */
  const zbtn = document.createElement('button');
  zbtn.type = 'button';
  zbtn.className = 'pchip pchip-houses on';
  zbtn.title = '✶ HOUSES';
  zbtn.setAttribute('aria-label', 'toggle the 13 houses layer');
  zbtn.setAttribute('aria-pressed', 'true');
  const zdot = document.createElement('span');
  zdot.className = 'pdot';
  zdot.setAttribute('aria-hidden', 'true');
  zdot.textContent = '✶';
  const zlbl = document.createElement('span');
  zlbl.className = 'plabel';
  zlbl.textContent = '✶ HOUSES';
  zbtn.append(zdot, zlbl);
  zbtn.addEventListener('click', () => {
    const off = zodiacG.style.display === 'none';
    zodiacG.style.display = off ? '' : 'none';
    zbtn.classList.toggle('on', off);
    zbtn.setAttribute('aria-pressed', String(off));
  }, sig);
  chipsEl.appendChild(zbtn);
  /* the wanderers' switch — a THREE-STATE cycle beside ✶ HOUSES (v26):
     BAND (the shared sky band, ruled ring order — today's view) →
     RINGS (the revelation: the WHOLE dial re-sorts by true lap period,
     every planet on its own orbit) → OFF (no planets, ruled order).
     A LAYER control like the houses: cyan for "lit", never the selection
     gold — the OFF state rests dimmed as '☿ PLANETS'. */
  const PSTATE: Record<'band' | 'rings' | 'off', { label: string; tip: string }> = {
    band: { label: '☿ BAND', tip: 'the wanderers on their shared sky band, rings in the ruled order · tap → RINGS: the whole dial re-sorts by true lap period' },
    rings: { label: '☿ RINGS', tip: 'every orbit sorted by its lap in blocks — each planet on its own ring; watch MONTH kiss EARTH · tap → planets off' },
    off: { label: '☿ PLANETS', tip: 'no planets, rings in the ruled order · tap → BAND: the wanderers return on their sky band' },
  };
  const pbtn = document.createElement('button');
  pbtn.type = 'button';
  pbtn.className = 'pchip pchip-planets on';
  const pdot = document.createElement('span');
  pdot.className = 'pdot';
  pdot.setAttribute('aria-hidden', 'true');
  pdot.textContent = '☿︎';
  const plbl = document.createElement('span');
  plbl.className = 'plabel';
  pbtn.append(pdot, plbl);
  function pchip() {
    const s = PSTATE[planetMode];
    plbl.textContent = s.label;
    pbtn.title = s.tip;
    pbtn.setAttribute('aria-label', 'the wanderers — state ' + planetMode.toUpperCase() + ': ' + s.tip);
    const on = planetMode !== 'off';
    pbtn.classList.toggle('on', on);
    pbtn.setAttribute('aria-pressed', String(on));
  }
  /* applyLayout — the radius map made flesh: every radius-dependent element
     (ring line, ticks, name path, selection arcs, planet position via cr)
     re-reads radiusOf(key, mode) in place. NO teardown, NO new listeners —
     selection, chip lit-states, scrub/pick mode and the rAF loop all keep
     driving whichever layout is live. Rim furniture and the sun stay put. */
  function applyLayout() {
    const lay: 'rings' | 'home' = planetMode === 'rings' ? 'rings' : 'home';
    planets.forEach(o => {
      if (!o.rg) return;
      const r = radiusOf(o.rg.key, lay);
      o.cr = r;
      o.ring!.setAttribute('r', String(r));
      o.bandHit!.setAttribute('r', String(r));
      o.fillA!.setAttribute('r', String(r));
      o.remA!.setAttribute('r', String(r));
      o.lblPath!.setAttribute('d', 'M ' + r + ' 0 A ' + r + ' ' + r + ' 0 1 1 -' + r + ' 0 A ' + r + ' ' + r + ' 0 1 1 ' + r + ' 0');
      o.tickEls!.forEach((ln, k) => {
        const ta = k / o.rg!.ticks! * 2 * Math.PI - Math.PI / 2;
        ln.setAttribute('x1', ((r - 2.5) * Math.cos(ta)).toFixed(2));
        ln.setAttribute('y1', ((r - 2.5) * Math.sin(ta)).toFixed(2));
        ln.setAttribute('x2', ((r + 2.5) * Math.cos(ta)).toFixed(2));
        ln.setAttribute('y2', ((r + 2.5) * Math.sin(ta)).toFixed(2));
      });
    });
    skyG.style.display = planetMode === 'off' ? 'none' : '';
    skyBand.style.display = planetMode === 'band' ? '' : 'none';
    wanderers.forEach(o => {
      o.cr = radiusOf(o.w.name, lay);
      o.orb.style.display = planetMode === 'rings' ? '' : 'none';
    });
    renderOrrery(); renderRead();
  }
  pbtn.addEventListener('click', () => {
    planetMode = planetMode === 'band' ? 'rings' : planetMode === 'rings' ? 'off' : 'band';
    pchip(); applyLayout();
  }, sig);
  pchip();
  chipsEl.appendChild(pbtn);
  function hotRing() {
    planets.forEach((o, i) => { if (o.ring) o.ring.classList.toggle('hot', sel === i); });
  }
  const pick = (e: Event) => {
    const t = e.target as Element | null;
    const i = t && t.getAttribute ? t.getAttribute('data-i') : null;
    if (i !== null && i !== undefined) { sel = i === 'sun' ? 'sun' : +i; hotRing(); renderFact(); }
  };
  orr.addEventListener('pointerover', pick, sig);
  orr.addEventListener('click', pick, sig);

  scrub.addEventListener('input', () => { mode = 'scrub'; renderOrrery(); renderRead(); }, sig);
  nowbtn.addEventListener('click', () => {
    mode = 'live'; scrub.value = String(tip); renderOrrery(); renderRead();
  }, sig);

  /* the date picker — point the whole orrery at any date; pre-genesis dates
     are welcome and read honestly in b₿, blocks-before-genesis.
     THE DATE-FIELD LAW (v27): iOS/WebKit renders an EMPTY date input as a
     blank gray select-looking pill — default SET THE CLOCK to today so the
     field always reads as a date. Setting .value fires no change event:
     the dial stays LIVE until the fren actually picks. */
  if (!clockDate.value) {
    const d0 = new Date();
    clockDate.value = d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0') + '-' + String(d0.getDate()).padStart(2, '0');
  }
  clockDate.addEventListener('change', () => {
    if (!clockDate.value) return;
    const [y, m, d] = clockDate.value.split('-').map(Number);
    pickH = Math.round(ms2h(Date.UTC(y, m - 1, d, 12)));
    mode = 'pick';
    if (pickH >= 0 && pickH <= LAST) scrub.value = String(pickH);
    renderOrrery(); renderRead();
    clockNote.textContent = '= ' + (pickH < 0 ? nf(pickH) + ' blocks before genesis (b₿)' : '~block ' + nf(pickH));
  }, sig);

  /* the slow dance: rAF while live; reduced motion holds true positions instead */
  let destroyed = false;
  let rafId = 0;
  let reducedInterval: ReturnType<typeof setInterval> | undefined;
  let watchdogId: ReturnType<typeof setInterval> | undefined;
  let io: IntersectionObserver | undefined;
  let inView = true;                          // the park brake — false while scrolled away
  let lastText = 0;
  let lastFrameAt = Date.now();               // the watchdog's pulse — every frame stamps it
  if (!RM) {
    const tick = () => {
      if (destroyed || !inView) return;
      lastFrameAt = Date.now();
      if (mode === 'live') {
        renderOrrery(false);
        if (Date.now() - lastText > 1000) { lastText = Date.now(); renderFact(); renderRead(); }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    /* THE WATCHDOG (belt to the unwedge law's braces): if the page says it
       is VISIBLE but no animation frame has landed for >5 s, the rAF loop
       is dead (a throttled/soft-frozen tab that never fired visibilitychange
       on wake, or a cancelled chain) — re-arm it and repaint in place. Never
       fires on a hidden tab: browsers pause rAF there by design. Respects
       the park brake: it only resuscitates a loop that SHOULD be running. */
    watchdogId = setInterval(() => {
      if (destroyed || !inView || document.visibilityState !== 'visible') return;
      if (Date.now() - lastFrameAt > 5000) {
        cancelAnimationFrame(rafId);
        lastFrameAt = Date.now();
        rafId = requestAnimationFrame(tick);
        if (mode === 'live') { renderOrrery(); renderRead(); }
      }
    }, 2500);
    /* THE PARK LAW (mobile pass): a dial scrolled clear off the screen
       paints for nobody — park the rAF loop when the orrery leaves the
       viewport, re-arm it (with one immediate repaint, so no stale face
       ever shows) the moment it scrolls back in. Same shape as the wake
       law: the 30 s ladder poll keeps knocking either way, so the dial
       is already true when it returns. */
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((entries) => {
        const vis = entries[entries.length - 1].isIntersecting;
        if (destroyed || vis === inView) return;
        inView = vis;
        if (!inView) { cancelAnimationFrame(rafId); return; }
        lastFrameAt = Date.now();
        rafId = requestAnimationFrame(tick);
        if (mode === 'live') { renderOrrery(); renderRead(); }
      }, { rootMargin: '80px' });
      io.observe(root);
    }
  } else {
    /* reduced motion: no animation frames — but a clock still tells time.
       once a second the face, velocity and true positions refresh in place. */
    reducedInterval = setInterval(() => { if (mode === 'live') { renderOrrery(); renderRead(); } }, 1000);
  }

  /* ═══ ignition — the study's, on the ladder ═══ */
  scrub.value = String(tip);
  renderOrrery(); renderRead();
  fetchTip();                                     // the one network request, polled every 30 s
  const pollId = setInterval(fetchTip, POLL_MS);
  /* THE WAKE LAW: hidden tabs get their timers suspended — so the moment
     this page is looked at again (tab switch back, bfcache restore, the
     network returning) the ladder is walked IMMEDIATELY instead of waiting
     out a stale interval. All on the one leash; destroy() aborts them. */
  const wake = () => { if (!document.hidden) fetchTip(); };
  document.addEventListener('visibilitychange', wake, sig);
  window.addEventListener('pageshow', wake, sig);
  window.addEventListener('online', wake, sig);

  function destroy() {
    destroyed = true;
    ac.abort();
    io?.disconnect();
    cancelAnimationFrame(rafId);
    if (reducedInterval) clearInterval(reducedInterval);
    if (watchdogId) clearInterval(watchdogId);
    clearInterval(pollId);
  }

  return { destroy };
}
