"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StoredBuddy, BuddyVitals, BuddyCareAction } from "@/lib/bb/types";
import { bft, moonPhase, yearAnimal } from "@/lib/bb/bft";
import { bftScene, drawBftBackground, type BftScene } from "@/lib/bb/scene";
import BftDate from "@/components/bb/BftDate";
import {
  applyCare, decayVitals, isDead, statusLine, stageForAgeDays, STAGES, DEATH_CAUSES,
} from "@/lib/bb/engine";

const C = {
  neon: "#5ef78a", cyan: "#53e0d4", coin: "#f7c948", ghost: "#ff6b6b", pink: "#b795ff", fg: "#f1efe7",
};
const COOLDOWN: Record<BuddyCareAction, number> = { feed: 4, play: 4, sleep: 6, talk: 3 };
const ACTIONS: { a: BuddyCareAction; icon: string; label: string }[] = [
  { a: "feed", icon: "🍎", label: "Feed" }, { a: "play", icon: "🎾", label: "Play" },
  { a: "sleep", icon: "💤", label: "Sleep" }, { a: "talk", icon: "💬", label: "Talk" },
];
const meterColor = (v: number) => `hsl(${(Math.max(0, v) / 100) * 142} 78% 60%)`;

export default function BuddyDevice({
  buddy, currentBlock, estimatedBlock = false, onChange, onNew,
}: {
  buddy: StoredBuddy;
  currentBlock: number;
  /** true when the height is an offline estimate — heights render with the honest ~. */
  estimatedBlock?: boolean;
  onChange: (b: StoredBuddy) => void;
  onNew: () => void;
}) {
  const [vitals, setVitals] = useState<BuddyVitals>(buddy.vitals);
  const [alive, setAlive] = useState<boolean>(buddy.alive);
  const [cause, setCause] = useState<string | undefined>(buddy.cause);
  const [speech, setSpeech] = useState("");
  const [cooldowns, setCooldowns] = useState<Partial<Record<BuddyCareAction, number>>>({}); // action → end-ts

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const vitalsRef = useRef(vitals);
  const aliveRef = useRef(alive);
  const causeRef = useRef(cause);
  const blockRef = useRef(currentBlock);
  const reactionRef = useRef<{ type: string; until: number } | null>(null);
  const lastDanceRef = useRef(0);
  const coolRef = useRef<Partial<Record<BuddyCareAction, number>>>({});
  const lastTickRef = useRef(buddy.lastTick);
  const lastSaveRef = useRef(0);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { vitalsRef.current = vitals; }, [vitals]);
  useEffect(() => { aliveRef.current = alive; }, [alive]);
  useEffect(() => { causeRef.current = cause; }, [cause]);
  useEffect(() => { blockRef.current = currentBlock; }, [currentBlock]);

  const persist = useCallback((extra: Partial<StoredBuddy> = {}) => {
    onChange({
      ...buddy,
      vitals: vitalsRef.current,
      alive: aliveRef.current,
      cause: causeRef.current,
      lastTick: lastTickRef.current,
      ...extra,
    });
    lastSaveRef.current = Date.now();
  }, [buddy, onChange]);
  const persistRef = useRef(persist);
  useEffect(() => { persistRef.current = persist; });

  // (re)initialise when the buddy identity changes
  useEffect(() => {
    setVitals(buddy.vitals);
    setAlive(buddy.alive);
    setCause(buddy.cause);
    vitalsRef.current = buddy.vitals;
    aliveRef.current = buddy.alive;
    lastTickRef.current = buddy.lastTick;
    coolRef.current = {};
    const img = new Image();
    img.onload = () => { spriteRef.current = img; };
    img.src = buddy.sprite;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buddy.id]);

  const say = useCallback((text: string) => {
    setSpeech(text);
    if (speechTimer.current) clearTimeout(speechTimer.current);
    speechTimer.current = setTimeout(() => setSpeech(""), 3200);
  }, []);

  const die = useCallback(() => {
    const c = DEATH_CAUSES[Math.floor(Math.random() * DEATH_CAUSES.length)];
    aliveRef.current = false;
    causeRef.current = c;
    setAlive(false);
    setCause(c);
    persistRef.current({ alive: false, cause: c });
  }, []);

  const doAction = useCallback((a: BuddyCareAction) => {
    if (!aliveRef.current) return;
    if ((coolRef.current[a] ?? 0) > Date.now()) return;
    const { index } = stageForAgeDays(Math.max(0, (blockRef.current - buddy.bornBlock) / 144));
    const res = applyCare(a, vitalsRef.current, STAGES[index]);
    say(res.quip);
    if (!res.reaction) return; // e.g. too tired to play — no cooldown, no change
    const end = Date.now() + COOLDOWN[a] * 1000;
    coolRef.current[a] = end;
    setCooldowns((c) => ({ ...c, [a]: end }));
    setTimeout(() => {
      delete coolRef.current[a];
      setCooldowns((c) => { const n = { ...c }; delete n[a]; return n; });
    }, COOLDOWN[a] * 1000);
    /* ONE clock for reactions (the dead-buttons fix, 0018.04.15 a₿): the draw
       loop compares `until` against the rAF timestamp, which runs on the
       performance.now() timebase — stamping it with Date.now() (epoch ms,
       ~57 years bigger) left the sprite "reacting" forever at progress 0. */
    reactionRef.current = { type: res.reaction, until: performance.now() + 1100 };
    vitalsRef.current = res.vitals;
    setVitals(res.vitals);
    if (isDead(res.vitals)) { die(); return; }
    persistRef.current();
  }, [buddy.bornBlock, say, die]);

  // decay loop — vitals fall on real time (≈ block cadence); persist throttled
  useEffect(() => {
    const id = setInterval(() => {
      if (!aliveRef.current) return;
      const now = Date.now();
      const elapsed = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      const next = decayVitals(vitalsRef.current, elapsed);
      vitalsRef.current = next;
      setVitals(next);
      if (isDead(next)) { die(); return; }
      if (now - lastSaveRef.current > 10_000) persistRef.current();
    }, 1000);
    return () => clearInterval(id);
  }, [die]);

  // persist on unmount so a quick visit isn't lost
  useEffect(() => () => { persistRef.current(); }, []);

  // ---- canvas render loop ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    let raf = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* The BFT-procedural garden, cached PER BLOCK (the same perf lesson as the
       old cached gradient/moon, one level up): the whole static scene — beat
       lighting, seasonal tint, moon, constellation, hills — is a pure function
       of the height, painted once per block into an offscreen canvas. The rAF
       loop only blits it; the dynamic bits are star twinkle + the block-break
       shimmer + the sprite. */
    const bg = document.createElement("canvas");
    bg.width = W; bg.height = H;
    const bgctx = bg.getContext("2d")!;
    let bgHeight = -1;
    let scene: BftScene | null = null;
    let shimmerAt = -1; // rAF-clock ms of the last block break

    const draw = (t: number) => {
      if (blockRef.current !== bgHeight) {
        if (bgHeight !== -1 && !reduce) shimmerAt = t; // the block broke mid-visit
        bgHeight = blockRef.current;
        scene = bftScene(bgHeight);
        drawBftBackground(bgctx, W, H, scene);
      }
      ctx.drawImage(bg, 0, 0);

      // twinkling stars — dynamic, fading with the beat's daylight
      const starGlow = scene ? scene.night : 1;
      if (starGlow > 0.04) {
        ctx.fillStyle = "rgba(241,239,231,0.5)";
        for (let i = 0; i < 16; i++) {
          const sx = (i * 53) % W, sy = (i * 29) % 110, tw = reduce ? 1 : 0.5 + 0.5 * Math.sin(t / 600 + i);
          ctx.globalAlpha = (0.15 + 0.4 * tw) * starGlow;
          ctx.fillRect(sx, sy, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // the block breaks → one soft shimmer sweeps the garden (skipped on reduced motion)
      if (shimmerAt >= 0 && t - shimmerAt < 1200) {
        const p = (t - shimmerAt) / 1200;
        const x = -80 + (W + 160) * p;
        const g = ctx.createLinearGradient(x - 70, 0, x + 70, 0);
        g.addColorStop(0, "rgba(222,251,233,0)");
        g.addColorStop(0.5, `rgba(222,251,233,${0.16 * Math.sin(p * Math.PI)})`);
        g.addColorStop(1, "rgba(222,251,233,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }

      // sprite
      const img = spriteRef.current;
      if (img) {
        const now = t;
        const reacting = reactionRef.current && now < reactionRef.current.until;
        let bob = reduce ? 0 : Math.sin(now / 380) * 5, sx = 1, sy = 1, rot = 0;
        if (!reduce && !reacting && now - lastDanceRef.current > 6000) {
          const dz = now - lastDanceRef.current - 6000;
          if (dz < 1600) { rot = Math.sin(now / 90) * 0.18; bob = Math.abs(Math.sin(now / 150)) * -10; }
          else lastDanceRef.current = now;
        }
        if (reacting) {
          const p = Math.min(1, Math.max(0, 1 - (reactionRef.current!.until - now) / 1100)); // 0→1
          const e = Math.sin(p * Math.PI); // smooth 0→1→0 envelope — starts & ends at rest, no snap
          const type = reactionRef.current!.type;
          if (type === "feed") { sy = 1 + e * 0.18; sx = 1 - e * 0.1; }         // happy stretch up
          else if (type === "play") { rot = Math.sin(p * Math.PI * 3) * 0.28 * e; bob += -e * 10; } // wiggle + hop (no jagged spin)
          else if (type === "sleep") { sy = 1 - e * 0.22; sx = 1 + e * 0.08; }  // gentle settle down
          else if (type === "talk") { rot = Math.sin(p * Math.PI * 2) * 0.14 * e; sy = 1 + e * 0.05; } // chatty sway
        }
        const ageDays = Math.max(0, (blockRef.current - buddy.bornBlock) / 144);
        const grow = 1 + stageForAgeDays(ageDays).index * 0.12;
        const size = 150 * grow;
        ctx.save();
        ctx.translate(W / 2, H - 58 + bob);
        ctx.rotate(rot);
        ctx.scale(sx, sy);
        ctx.imageSmoothingEnabled = false;
        if (!aliveRef.current) ctx.globalAlpha = 0.25;
        ctx.drawImage(img, -size / 2, -size, size, size);
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [buddy.bornBlock]);

  // ---- derived display ----
  const ageDays = Math.max(0, Math.floor((currentBlock - buddy.bornBlock) / 144));
  const stage = stageForAgeDays(ageDays).stage;
  const status = statusLine(buddy.name, vitals);
  const animal = yearAnimal(buddy.bornBlock);
  /* One source of truth for the sky: glyph + name + BFT day all come from
     moonPhase/bft — the old footer hardcoded a 🌙 crescent next to the real
     phase NAME, so mid-month it lied "🌙 Full" (fixed 0018.04.15 a₿). */
  const moon = moonPhase(currentBlock);
  const bftDay = bft(currentBlock).day;
  const tilde = estimatedBlock ? "~" : "";

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border-2 border-edge bg-panel p-5">
      {/* status bar */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-pixel text-xs uppercase tracking-widest text-white">
          {buddy.name} <span aria-hidden>💜</span>
        </span>
        <span className="rounded-full border border-pink/30 bg-pink/10 px-2 py-1 font-mono text-[10px] text-pink">
          {buddy.name}@frens.earth
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-wider text-white/50">
        <span className="rounded border border-edge px-2 py-1">Stage · {stage}</span>
        <span className="rounded border border-edge px-2 py-1">Age · {ageDays} d</span>
        <span className="rounded border border-coin/30 px-2 py-1 text-coin">Born · <BftDate height={buddy.bornBlock} /></span>
        <span className="rounded border border-edge px-2 py-1">{animal.emoji} {animal.name}</span>
      </div>

      {/* LCD */}
      <div className="relative mt-4 overflow-hidden rounded-xl border-2 border-edge bg-[#0a0f0c]" style={{ aspectRatio: "6 / 5" }}>
        <canvas ref={canvasRef} width={384} height={320} className="block h-full w-full" style={{ imageRendering: "pixelated" }} />
        {speech && (
          <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-lg bg-neon px-3 py-2 text-center font-mono text-xs text-void">
            {speech}
          </div>
        )}
        <div
          className="absolute inset-x-0 bottom-2 text-center font-mono text-[11px]"
          style={{ color: alive ? (status.level === "crit" ? C.ghost : status.level === "warn" ? C.coin : C.neon) : "transparent" }}
        >
          {status.text}
        </div>
        {!alive && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 p-5 text-center"
            style={{ background: "radial-gradient(120% 90% at 50% 30%, rgba(20,10,12,.72), rgba(6,8,7,.94))" }}>
            <div className="text-4xl">🪦</div>
            <p className="max-w-[30ch] font-mono text-xs leading-relaxed text-white">
              Here lies <strong style={{ color: C.ghost }}>{buddy.name}</strong><br />
              lived {ageDays} day{ageDays === 1 ? "" : "s"} on the block<br />
              <span className="text-white/50">{cause}</span>
            </p>
            <button onClick={onNew} className="button mt-1">Bring home a new fren</button>
          </div>
        )}
      </div>

      {/* meters */}
      <div className="mt-4 flex flex-col gap-3">
        {(["hunger", "happiness", "energy"] as const).map((k) => (
          <div key={k} className="grid grid-cols-[64px_1fr_36px] items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">{k === "happiness" ? "Happy" : k}</span>
            <div className="relative h-3.5 overflow-hidden rounded border border-edge bg-[#0b120e]">
              <div className="absolute inset-y-0.5 left-0.5 rounded-sm transition-[width,background-color] duration-300"
                style={{ width: `${Math.max(0, Math.min(100, vitals[k]))}%`, background: meterColor(vitals[k]) }} />
            </div>
            <span className="text-right font-mono text-xs tabular-nums text-white">{Math.round(vitals[k])}</span>
          </div>
        ))}
      </div>

      {/* actions */}
      <style>{`@keyframes bbCooldown { from { height: 100%; } to { height: 0%; } }`}</style>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {ACTIONS.map(({ a, icon, label }) => {
          const cooling = alive && (cooldowns[a] ?? 0) > Date.now();
          return (
            <button key={a} onClick={() => doAction(a)} disabled={!alive || cooling}
              className="relative flex flex-col items-center gap-1.5 overflow-hidden rounded-xl border border-edge bg-gradient-to-b from-[#1c2a20] to-[#131b15] px-1.5 pb-3 pt-3 font-mono text-[11px] uppercase tracking-wider text-white transition enabled:hover:border-neon disabled:cursor-not-allowed disabled:text-white/40">
              <span className="text-[17px] leading-none" aria-hidden>{icon}</span>
              {label}
              {cooling && (
                <span key={cooldowns[a]} className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-cyan/50 bg-cyan/20"
                  style={{ animation: `bbCooldown ${COOLDOWN[a]}s linear forwards` }} />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-wider text-white/40">
          Tick tock · blk {tilde}{currentBlock.toLocaleString()} · D{String(bftDay).padStart(2, "0")} {moon.emoji} {moon.name}
        </span>
        <button onClick={onNew} className="font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-neon">＋ New</button>
      </div>
    </div>
  );
}
