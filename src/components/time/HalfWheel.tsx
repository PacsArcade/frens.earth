"use client";

/**
 * THE HALF-WHEEL — the orrery's mobile telling (the admiral's sketch,
 * benched with the crew, corrected against the big map 2026-07-27).
 *
 * The ₿ sun docks half-off the right edge; the visible 180° is the sky.
 * Thirteen rings arc across it, filling bottom-to-top; every ball carries a
 * living count. Tap a ring (or its label) and its card seats in the sun's
 * face speaking the big map's tongue — positions and names first, percent
 * last. Chevrons step outward/inward matching the way they point. When a
 * block runs long the countdown freezes at 0:00 and the ember trembles
 * outward through the rings — the loaded chain, as the arcade tells it.
 * Below the wheel: the comment strip and the date door. Desktop keeps the
 * full wheel.
 */

import { useEffect, useRef, useState } from "react";
import {
  bftDate,
  bftTime,
  currentBlockInfo,
  estimateHeightAt,
  yearAnimal,
  GENESIS_MS,
} from "@/lib/bb/bft";
/* THE SKY'S moon, not the calendar's — see lib/bb/moon.ts. BFT's 28-day
   lunation drifts ~1.53 days a month against the real one, so bft.ts's
   moonPhase() would show a waning crescent on a night the moon is full. */
import { skyMoon, moonIlluminationAt } from "@/lib/bb/moon";

const LAST_SAT_HEIGHT = 6_930_000;

type Ring = {
  label: string;
  mod?: number;
  max?: number;
  kind?: "wall-s" | "wall-m" | "intra" | "moon";
  thin?: boolean;
};

const RINGS: Ring[] = [
  { label: "second", kind: "wall-s" },
  { label: "minute", kind: "wall-m" },
  { label: "block", kind: "intra" },
  { label: "hour", mod: 6 },
  { label: "day", mod: 144 },
  { label: "week", mod: 1008 },
  { label: "fortnight", mod: 2016 },
  { label: "month", mod: 4032 },
  { label: "moon", kind: "moon", mod: 4252 },
  { label: "year", mod: 52416 },
  { label: "olympiad", mod: 210000, thin: true },
  { label: "generation", mod: 1260000, thin: true },
  { label: "last sat", max: LAST_SAT_HEIGHT, thin: true },
];

const REL: Record<string, string> = {
  second: "the chain's pulse",
  minute: "= 60 secs",
  block: "= 10 mins",
  hour: "= 6 blocks",
  day: "= 24 hours",
  week: "= 7 days",
  fortnight: "= 2 weeks",
  month: "= 2 fortnights",
  moon: "≈ 29½ days",
  year: "= 13 months",
  olympiad: "= 4 years · a halving",
  generation: "= 6 halvings",
  "last sat": "≈ 5½ generations",
};

/* the whole 360° sky smooshed proportionally into the visible 180° —
   thirteen seats, Capricorn first (the month-seat law) */
const SKY_SIGNS = ["CAPRICORN", "AQUARIUS", "PISCES", "ARIES", "TAURUS", "GEMINI",
  "CANCER", "LEO", "VIRGO", "LIBRA", "SCORPIO", "OPHIUCHUS", "SAGITTARIUS"];

function intraBlockSeconds(now: Date, tipTs: number | null): number {
  if (tipTs) {
    const s = now.getTime() / 1000 - tipTs;
    return Math.max(0, Math.min(600, s));
  }
  return (now.getTime() / 1000) % 600;
}

/* moon ring: illumination fraction — new at the bottom, full at the top,
   waxing up the near side, waning back down.

   Anchored to the REAL new moon (lib/bb/moon.ts). The old version ran this
   same cosine off `h % 4252` — the right rhythm from the wrong origin, since
   block 0 was not a new moon — so the ring filled on its own schedule
   regardless of the sky. */
function moonIllumination(now: Date): number {
  return moonIlluminationAt(now.getTime());
}

/* display-clamped block seconds: parks at 9:59 when the chain is loaded */
function intraDisplay(now: Date, tipTs: number | null): number {
  return Math.min(599.999, intraBlockSeconds(now, tipTs));
}

function ringProgress(r: Ring, h: number, now: Date, tipTs: number | null): number {
  /* second and minute are the CHAIN's hands, derived from block time —
     when the block freezes at its top, they freeze with it */
  if (r.kind === "wall-s") return (intraDisplay(now, tipTs) % 60) / 60;
  if (r.kind === "wall-m") return ((h % 6) * 600 + intraDisplay(now, tipTs)) / 3600;
  if (r.kind === "intra") return intraDisplay(now, tipTs) / 600;
  if (r.kind === "moon") return moonIllumination(now);
  if (r.max) return h / r.max;
  return (h % (r.mod as number)) / (r.mod as number);
}

/* the count each ball carries — where we ARE, in the ring's own tongue */
function ringBall(r: Ring, h: number, now: Date, tipTs: number | null): number | string {
  switch (r.label) {
    case "second": return Math.floor(intraDisplay(now, tipTs)) % 60;
    case "minute": return (h % 6) * 10 + Math.floor(intraDisplay(now, tipTs) / 60);
    case "block": return Math.floor(intraDisplay(now, tipTs) / 60);
    case "hour": return h % 6;
    case "day": return Math.floor((h % 144) / 6);
    case "week": return Math.floor((h % 1008) / 144);
    case "fortnight": return Math.floor((h % 2016) / 1008);
    case "month": return Math.floor((Math.floor(h / 144) % 364) / 28) + 1; // month we are IN, 1..13
    case "moon": return skyMoon(now.getTime()).emoji;
    case "year": return Math.floor(Math.floor(h / 144) / 364); // the year we are IN — matches 0018
    case "olympiad": return Math.floor((h % 210000) / 52416);
    case "generation": return Math.floor((h % 1260000) / 210000);
    default: return Math.round((h / LAST_SAT_HEIGHT) * 100) + "%"; // road walked
  }
}

function compactNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + "M";
  if (n >= 1e4) return Math.round(n / 1e3) + "k";
  return n.toLocaleString();
}

type Card = { big: string; l1: string; l2: string; tremble?: boolean };

/* the sun card, speaking the big map's tongue: position and name first,
   percent last. big = the headline value; lines follow. */
function cardFor(r: Ring, h: number, now: Date, tipTs: number | null): Card {
  const clock = bftTime(h); // "hh:mm"
  const hh = Number(clock.slice(0, 2));
  const dayOfMonth = ((Math.floor(h / 144) % 364) % 28) + 1;
  const month = Math.floor((Math.floor(h / 144) % 364) / 28) + 1;
  const pct = (p: number) => `${Math.min(100, p * 100).toFixed(p * 100 < 10 ? 1 : 0)}%`;
  switch (r.label) {
    case "second": {
      const sec = Math.floor(intraDisplay(now, tipTs)) % 60;
      const frozen = tipTs !== null && intraBlockSeconds(now, tipTs) >= 600;
      return { big: String(sec), l1: `${sec} / 60 secs`, l2: frozen ? "the chain is loaded" : "of the bitcoin minute", tremble: frozen };
    }
    case "minute": {
      const bmin = (h % 6) * 10 + Math.floor(intraDisplay(now, tipTs) / 60);
      const frozen = tipTs !== null && intraBlockSeconds(now, tipTs) >= 600;
      return { big: String(bmin), l1: `minute ${bmin} / 60`, l2: frozen ? "the chain is loaded" : `of hour ${Number(bftTime(h).slice(0, 2))}`, tremble: frozen };
    }
    case "block": {
      const s = Math.floor(intraBlockSeconds(now, tipTs));
      const remain = Math.max(0, 600 - s);
      const mm = Math.floor(remain / 60), ss = remain % 60;
      const loaded = tipTs !== null && s >= 600;
      return {
        big: `${mm}:${String(ss).padStart(2, "0")}`,
        l1: loaded ? "the chain is loaded" : "to the next block",
        l2: loaded ? "any moment now…" : `${s}s into this one`,
        tremble: loaded,
      };
    }
    case "hour":
      return { big: String(hh), l1: `hour ${hh} / 24`, l2: `${6 - (h % 6)} blocks to the next` };
    case "day":
      return { big: String(dayOfMonth), l1: `day ${dayOfMonth} / 28`, l2: `${144 - (h % 144)} blocks left today` };
    case "week": {
      const week = Math.floor((dayOfMonth - 1) / 7) + 1;
      return { big: String(week), l1: `week ${week} / 4 this month`, l2: `${compactNum(1008 - (h % 1008))} blocks left` };
    }
    case "fortnight":
      return { big: compactNum(2016 - (h % 2016)), l1: "blocks to the retarget", l2: `${pct((h % 2016) / 2016)} through` };
    case "month":
      return { big: `${month} / 13`, l1: `day ${dayOfMonth} / 28`, l2: `${compactNum(4032 - (h % 4032))} blocks left` };
    case "moon": {
      /* the moon actually overhead — age counted from the real new moon,
         not from block 0 (lib/bb/moon.ts) */
      const ph = skyMoon(now.getTime());
      const dmoon = Math.floor(ph.ageDays) + 1;
      return { big: ph.emoji, l1: ph.name, l2: `day ${dmoon} of ≈30` };
    }
    case "year": {
      const yr = Math.floor(Math.floor(h / 144) / 364);
      const animal = yearAnimal(h);
      const togo = 100 - Math.min(100, ((h % 52416) / 52416) * 100);
      return { big: `year ${yr}`, l1: `${animal.emoji} ${animal.name} — bitcoin's age`, l2: `${togo.toFixed(0)}% to go` };
    }
    case "olympiad":
      return { big: compactNum(210000 - (h % 210000)), l1: "blocks to the halving", l2: `epoch ${Math.floor(h / 210000)}` };
    case "generation":
      return { big: `${Math.floor((h % 1260000) / 210000)} / 6`, l1: "halvings this generation", l2: `${pct((h % 1260000) / 1260000)} through` };
    default:
      return { big: pct(h / LAST_SAT_HEIGHT), l1: "of the road walked", l2: `${compactNum(LAST_SAT_HEIGHT - h)} blocks left` };
  }
}

/* the comment strip's one-liner, in the big map's voice */
function stripFor(r: Ring | null, h: number, now: Date, tipTs: number | null): string {
  if (!r) return `block ${h.toLocaleString()} · ${bftDate(h)} · tap a ring to learn its lap`;
  const c = cardFor(r, h, now, tipTs);
  const span = r.max ? `${compactNum(r.max)} blocks` : r.mod ? `${compactNum(r.mod)} blocks` : "the block's beat";
  return `${r.label.toUpperCase()} · ${span} · ${c.big} — ${c.l1} · ${c.l2}`;
}

export default function HalfWheel() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [doorDate, setDoorDate] = useState("");
  const [tipHeight, setTipHeight] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let height: number | null = null;
    let estimated = true;
    let tipTs: number | null = null;
    let selected: number | null = null;
    let disposed = false;
    let radii: number[] = [];
    let sunGeom = { cx: 0, cy: 0, sunR: 0 };
    let chevrons: { out: number[]; inn: number[] } | null = null; // [x,y,w,h]

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    async function poll(fresh = false) {
      try {
        const info = await currentBlockInfo(fresh ? { fresh: true } : undefined);
        if (disposed) return;
        height = info.height;
        estimated = info.estimated;
        tipTs = info.tipTimestamp;
        setTipHeight(info.height);
        draw();
      } catch {
        /* keep the last reading */
      }
    }

    function fitPx(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, bold: boolean): number {
      while (px > 8) {
        ctx.font = `${bold ? "bold " : ""}${px}px ui-monospace, monospace`;
        if (ctx.measureText(text).width <= maxW) break;
        px -= 1;
      }
      return px;
    }

    function draw() {
      if (!canvas || height === null) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const hg = canvas.clientHeight;
      if (!w || !hg) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(hg * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, hg);
      const now = new Date();
      const h = height;

      const cx = w + 6, cy = hg * 0.5;
      const maxR = Math.min(hg * 0.455, cx - 26);
      /* the sun yields to the ring band at wide/short aspects */
      const sunR = Math.max(88, Math.min(w * 0.29, maxR - 150));
      sunGeom = { cx, cy, sunR };

      /* the loaded chain: block overdue → ember trembles outward */
      const intraS = intraBlockSeconds(now, tipTs);
      const loaded = tipTs !== null && intraS >= 600;

      /* stars */
      for (let i = 0; i < 34; i++) {
        const sx = 8 + ((i * 89 + 17) % Math.round(w * 0.55));
        const sy = (i * 53 + 29) % hg;
        ctx.fillStyle = i % 6 ? "rgba(255,255,255,0.25)" : "rgba(61,255,122,0.4)";
        ctx.fillRect(sx, sy, 1, 1);
      }

      /* the sign belt */
      const beltPad = 0.06, beltSpan = Math.PI - beltPad * 2;
      SKY_SIGNS.forEach((name, i) => {
        const a = Math.PI / 2 + beltPad + ((i + 0.5) / SKY_SIGNS.length) * beltSpan;
        const rad = maxR + 16;
        const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
        if (x > 12 && y > 12 && y < hg - 12) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(a + Math.PI / 2);
          ctx.fillStyle = "rgba(242,233,212,0.34)";
          ctx.font = "8px ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.fillText(name, 0, 0);
          ctx.restore();
        }
        const ba = Math.PI / 2 + beltPad + (i / SKY_SIGNS.length) * beltSpan;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ba) * (maxR + 6), cy + Math.sin(ba) * (maxR + 6));
        ctx.lineTo(cx + Math.cos(ba) * (maxR + 11), cy + Math.sin(ba) * (maxR + 11));
        ctx.strokeStyle = "rgba(242,233,212,0.22)";
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      /* rings */
      radii = [];
      const blockIdx = RINGS.findIndex((r) => r.kind === "intra");
      RINGS.forEach((r, idx) => {
        const rad = sunR + 12 + (idx / (RINGS.length - 1)) * (maxR - sunR - 18);
        radii.push(rad);
        const p = Math.max(0, Math.min(1, ringProgress(r, h, now, tipTs)));
        const a0 = Math.PI / 2, a1 = Math.PI * 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, a0, a1);
        ctx.strokeStyle = "rgba(242,233,212,0.26)";
        ctx.lineWidth = r.thin ? 1 : 1.5;
        ctx.stroke();
        const sel = selected === idx;
        /* the ripple: when the chain is loaded, ember radiates from the
           block ring outward, fading with distance — the arcade's tell */
        let stroke = sel ? "#ffb01f" : `rgba(61,255,122,${r.thin ? 0.45 : 0.85})`;
        if (loaded && !sel && !reduced) {
          /* one crest, born at the block ring, sweeping cleanly outward,
             then a beat of quiet before the next */
          const PULSE_SECS = 2.6;
          const phase = ((now.getTime() / 1000) % PULSE_SECS) / PULSE_SECS;
          const front = phase * (RINGS.length + 3) - 1;
          const dist = Math.abs(idx - blockIdx);
          const glow = Math.exp(-((dist - front) ** 2) / 0.7);
          if (glow > 0.05) {
            const g = Math.round(176 - 74 * glow);
            stroke = `rgba(255,${g},31,${0.35 + 0.55 * glow})`;
          }
        }
        ctx.beginPath();
        ctx.arc(cx, cy, rad, a0, a0 + p * Math.PI);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = sel ? 4.5 : r.thin ? 2 : 3.5;
        ctx.lineCap = "round";
        ctx.stroke();
        /* the end-ball */
        const ea = a0 + p * Math.PI;
        let ex = cx + Math.cos(ea) * rad, ey = cy + Math.sin(ea) * rad;
        if (loaded && r.kind === "intra" && !reduced) {
          ex += (Math.random() - 0.5) * 2.4; // the tremble
          ey += (Math.random() - 0.5) * 2.4;
        }
        let ballVal = ringBall(r, h, now, tipTs);
        if (ballVal === 0) ballVal = Math.round(p * 100) + "%"; // zeros say nothing
        const ballTxt = String(ballVal);
        const isEmoji = r.kind === "moon";
        const isWide = !isEmoji && ballTxt.length >= 3;
        const br = isEmoji ? 10 : isWide ? (ballTxt.length >= 6 ? 15 : 11) : r.thin ? 7 : 9;
        ctx.beginPath();
        ctx.arc(ex, ey, br, 0, Math.PI * 2);
        ctx.fillStyle = sel ? "#ffb01f" : "#f2e9d4";
        ctx.fill();
        ctx.strokeStyle = "rgba(5,9,12,0.8)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = "#141a16";
        ctx.font = isEmoji
          ? "12px ui-monospace, monospace"
          : `bold ${isWide ? 7.5 : r.thin ? 7.5 : 8.5}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ballTxt, ex, ey + 0.5);
        ctx.textBaseline = "alphabetic";
        /* label — fades while its own ball passes the lane */
        const la = Math.PI * 1.16;
        const lx = cx + Math.cos(la) * rad, ly = cy + Math.sin(la) * rad;
        if (lx > 16) {
          const alpha = Math.abs(ea - la) < 0.16 ? 0.15 : 0.78;
          ctx.save();
          ctx.translate(lx, ly);
          ctx.rotate(la + Math.PI / 2);
          ctx.fillStyle = `rgba(242,233,212,${alpha})`;
          ctx.font = "10px ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.fillText(r.label.toUpperCase(), 0, -6);
          ctx.restore();
        }
      });

      /* corner pills */
      const pill = (x: number, y: number, pw: number, ph: number) => {
        ctx.fillStyle = "rgba(4,8,10,0.82)";
        ctx.strokeStyle = "rgba(255,176,31,0.22)";
        ctx.fillRect(x, y, pw, ph);
        ctx.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
      };
      const tilde = estimated ? "~" : "";
      ctx.textAlign = "left";
      const dateTxt = `${tilde}${bftDate(h)}`;
      const clockTxt = bftTime(h);
      const datePx = fitPx(ctx, dateTxt, 150, 14, true);
      ctx.font = `bold ${datePx}px ui-monospace, monospace`;
      const dateW = ctx.measureText(dateTxt).width;
      ctx.font = "bold 13px ui-monospace, monospace";
      const timeW = ctx.measureText(clockTxt).width;
      pill(12, 12, Math.max(dateW, timeW) + 18, 46);
      ctx.fillStyle = "#3dff7a";
      ctx.font = `bold ${datePx}px ui-monospace, monospace`;
      ctx.fillText(dateTxt, 21, 30);
      ctx.fillStyle = "#f2e9d4";
      ctx.font = "bold 13px ui-monospace, monospace";
      ctx.fillText(clockTxt, 21, 50);

      const blockTxt = `${tilde}block ${h.toLocaleString()}`;
      const blockPx = fitPx(ctx, blockTxt, w - 60, 17, true);
      ctx.font = `bold ${blockPx}px ui-monospace, monospace`;
      const blockW = ctx.measureText(blockTxt).width;
      pill(12, hg - 44, blockW + 24, 32);
      ctx.shadowColor = "rgba(255,176,31,0.5)";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#ffb01f";
      let bx = 24;
      if (loaded && !reduced) bx += (Math.random() - 0.5) * 1.6; // the tremble
      ctx.fillText(blockTxt, bx, hg - 21);
      ctx.shadowBlur = 0;

      /* the sun */
      const grad = ctx.createRadialGradient(cx - sunR * 0.3, cy - sunR * 0.3, sunR * 0.15, cx, cy, sunR);
      grad.addColorStop(0, "#ffd37a");
      grad.addColorStop(0.55, "#ffb01f");
      grad.addColorStop(1, loaded ? "#ff4d1f" : "#ff6600");
      ctx.beginPath();
      ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,211,122,0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();

      /* sun face rows: right-aligned, budgeted by the rim's curve */
      const PAD_R = 8;
      const sunRow = (text: string, y: number, basePx: number, bold: boolean, color: string) => {
        const dy = Math.abs(y - cy);
        if (dy >= sunR - 4) return;
        const rimX = cx - sunR * Math.sqrt(1 - (dy / sunR) ** 2);
        const maxW = w - PAD_R - rimX - 10;
        const px = fitPx(ctx, text, maxW, basePx, bold);
        ctx.font = `${bold ? "bold " : ""}${px}px ui-monospace, monospace`;
        let txt = text;
        while (txt.length > 2 && ctx.measureText(txt).width > maxW) {
          txt = txt.slice(0, -2).replace(/\s+$/, "") + "…";
        }
        ctx.fillStyle = color;
        ctx.textAlign = "right";
        ctx.fillText(txt, w - PAD_R, y);
      };
      const sunRowWrap = (text: string, y: number, basePx: number, bold: boolean, color: string) => {
        const dy = Math.abs(y - cy);
        if (dy >= sunR - 4) return;
        const rimX = cx - sunR * Math.sqrt(1 - (dy / sunR) ** 2);
        const maxW = w - PAD_R - rimX - 10;
        ctx.font = `${bold ? "bold " : ""}${basePx}px ui-monospace, monospace`;
        if (ctx.measureText(text).width <= maxW) {
          sunRow(text, y, basePx, bold, color);
          return;
        }
        const words = text.split(" ");
        let best = 1, bestDiff = Infinity;
        for (let k = 1; k < words.length; k++) {
          const diff = Math.abs(
            ctx.measureText(words.slice(0, k).join(" ")).width -
            ctx.measureText(words.slice(k).join(" ")).width,
          );
          if (diff < bestDiff) { bestDiff = diff; best = k; }
        }
        sunRow(words.slice(0, best).join(" "), y, basePx, bold, color);
        sunRow(words.slice(best).join(" "), y + basePx + 3, basePx, bold, color);
      };

      const ink = "#241300", inkSoft = "rgba(36,19,0,0.9)";
      chevrons = null;
      if (selected === null) {
        sunRow("BITCOIN TIME", cy - sunR * 0.36, 10, false, ink);
        sunRow(clockTxt, cy + 4, 34, true, ink);
        sunRow("6 blocks an hour", cy + 24, 10.5, false, ink);
        sunRow("tap a ring", cy + sunR * 0.44, 10, false, inkSoft);
      } else {
        const r3 = RINGS[selected];
        const card = cardFor(r3, h, now, tipTs);
        let jx = 0;
        if (card.tremble && !reduced) jx = (Math.random() - 0.5) * 1.6;
        sunRow(r3.label.toUpperCase(), cy - sunR * 0.46, 12, true, ink);
        sunRowWrap(REL[r3.label] || "", cy - sunR * 0.46 + 15, 9.5, false, ink);
        ctx.save();
        ctx.translate(jx, 0);
        sunRow(card.big, cy + 10, 28, true, ink);
        ctx.restore();
        sunRow(card.l1, cy + 28, 10, false, ink);
        sunRowWrap(card.l2, cy + 42, 10, false, ink);
        /* chevrons: point the way the rings actually lie — ‹ steps OUTWARD
           (leftward, away from the sun), › steps INWARD toward the sun */
        const chevY = cy + sunR * 0.86;
        if (chevY < cy + sunR - 8) {
          ctx.font = "bold 18px ui-monospace, monospace";
          ctx.fillStyle = inkSoft;
          ctx.textAlign = "center";
          const cxL = w - sunR * 0.55, cxR = w - PAD_R - 16;
          ctx.fillText("‹", cxL, chevY);
          ctx.fillText("›", cxR, chevY);
          chevrons = { out: [cxL - 22, chevY - 22, 44, 44], inn: [cxR - 22, chevY - 22, 44, 44] };
        }
      }

      /* the comment strip below the wheel, in the big map's voice */
      if (stripRef.current) {
        stripRef.current.textContent = stripFor(selected === null ? null : RINGS[selected], h, now, tipTs);
      }
    }

    function onClick(ev: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
      if (chevrons && selected !== null) {
        const inBox = (b: number[]) => x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3];
        if (inBox(chevrons.out)) { selected = (selected + 1) % RINGS.length; draw(); return; }
        if (inBox(chevrons.inn)) { selected = (selected + RINGS.length - 1) % RINGS.length; draw(); return; }
      }
      const d = Math.hypot(x - sunGeom.cx, y - sunGeom.cy);
      if (d <= sunGeom.sunR) { selected = null; draw(); return; }
      /* labels sit ~6-16px OUTSIDE their ring's line: taps in the label lane
         bias inward so tapping MOON never selects YEAR */
      const ang = Math.atan2(y - sunGeom.cy, x - sunGeom.cx);
      const norm = ang < 0 ? ang + Math.PI * 2 : ang;
      const inLabelLane = Math.abs(norm - Math.PI * 1.16) < 0.14;
      const dEff = inLabelLane ? d - 9 : d;
      let best: number | null = null, bestErr = 14;
      radii.forEach((rad, idx) => {
        const err = Math.abs(dEff - rad);
        if (err < bestErr) { bestErr = err; best = idx; }
      });
      if (best !== null) { selected = best; draw(); }
    }

    canvas.addEventListener("click", onClick);
    const onResize = () => draw();
    window.addEventListener("resize", onResize);

    void poll(true);
    const pollId = window.setInterval(() => void poll(), 60_000);
    const tickId = reduced ? null : window.setInterval(draw, 1000);
    /* the tremble needs a quicker brush when the chain is loaded */
    const trembleId = reduced ? null : window.setInterval(() => {
      if (height !== null && tipTs !== null && intraBlockSeconds(new Date(), tipTs) >= 600) draw();
    }, 120);

    return () => {
      disposed = true;
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
      window.clearInterval(pollId);
      if (tickId) window.clearInterval(tickId);
      if (trembleId) window.clearInterval(trembleId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* the date door — one input, the converter's answer, mobile edition */
  let doorAnswer: { date: string; height: number; pre: boolean } | null = null;
  if (doorDate) {
    const m = doorDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
      const hEst = estimateHeightAt(utc, tipHeight);
      doorAnswer = { date: utc < GENESIS_MS ? "" : bftDate(hEst), height: hEst, pre: utc < GENESIS_MS };
    }
  }

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <canvas
        ref={canvasRef}
        aria-label="The half-wheel: the bitcoin clock's mobile sky. Tap a ring for its reading."
        className="block w-full cursor-pointer touch-manipulation"
        style={{ height: "min(74vh, 700px)", minHeight: "480px" }}
      />
      {/* the comment strip — the big map's card, folded for the hand */}
      <div
        ref={stripRef}
        aria-live="polite"
        className="mt-2 border-2 border-edge bg-panel px-3 py-2 font-mono text-[11px] leading-relaxed text-white/70"
      />
      {/* the date door — give the clock a day */}
      <div className="mt-3 border-2 border-edge bg-panel p-3">
        <label className="block">
          <span className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-white/50">
            give the clock a day
          </span>
          <input
            type="date"
            value={doorDate}
            onChange={(e) => setDoorDate(e.target.value)}
            className="w-full border-2 border-edge bg-void px-3 py-2 font-mono text-sm text-cyan focus:border-cyan focus:outline-none"
          />
        </label>
        {doorAnswer && (
          <p className="mt-2 font-mono text-xs text-white/80">
            {doorAnswer.pre ? (
              <span className="text-heart">before the first block — a ghost-side date · b₿</span>
            ) : (
              <>
                <span className="text-neon">~ {doorAnswer.date}</span>{" "}
                <span className="text-white/60">
                  · ★~{doorAnswer.height.toLocaleString()} — the nearest block · full ceremony at /bday
                </span>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
