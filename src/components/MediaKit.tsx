"use client";

import { useState, useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import { frensEarthTheme } from "@/lib/brand";

/**
 * MEDIA / ASSETS — the emojipedia replacement, but ours. Copy a ₿, a sat mark,
 * the BFT markers, the house mark, the wordmark, the palette, and a press
 * blurb — all one click to the clipboard, without leaving home.
 *
 * House laws bound here: honest "copied ✓" states (and an honest "copy failed"
 * when the clipboard is blocked), NO wireframe arrows, motion-safe, mobile
 * first, and GOLD = MONEY ONLY — coin gold rides the ₿ and the sat mark
 * (sats are money); the a₿ / b₿ / ▣ markers are cyan (they're time), and ⚡
 * is neon (the live rail). Nothing decorative wears gold.
 */

/* The frens.earth mark source — the sprouting planet, byte-for-byte from
   public/frens-mark.svg so COPY SVG hands over the real asset. */
const FRENS_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" role="img" aria-label="frens.earth">
  <defs>
    <radialGradient id="fe-planet" cx="36%" cy="30%" r="82%">
      <stop offset="0%" stop-color="#1f3a2b"/>
      <stop offset="100%" stop-color="#0c1912"/>
    </radialGradient>
  </defs>
  <ellipse cx="24" cy="31" rx="20" ry="8" transform="rotate(-24 24 31)"
           fill="none" stroke="#b795ff" stroke-width="1.4" opacity="0.65"/>
  <circle cx="24" cy="31" r="14" fill="url(#fe-planet)" stroke="#53e0d4" stroke-width="2"/>
  <path d="M13.5 29c2.6-2.4 6-2.2 8.4-.6 1.7 1.2.9 3.5-1.4 4.2-3.3 1-6.7-.2-7.6-1.6-.6-1 .1-1.6.6-2z"
        fill="#53e0d4" opacity="0.5"/>
  <path d="M26.5 37c1.8-1 4-.6 5 .8.7 1-.2 2.3-2 2.4-2.7.2-4.3-1.6-3-3.2z"
        fill="#53e0d4" opacity="0.42"/>
  <path d="M24 20V10" stroke="#5ef78a" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M24 15c-1-4.6-4.4-6.4-8-6.6 .4 4.2 3.2 6.8 8 6.6z" fill="#5ef78a"/>
  <path d="M24 13c1-3.8 3.9-5.4 7-5.6-.4 3.5-2.8 5.8-7 5.6z" fill="#5ef78a"/>
  <circle cx="24" cy="8" r="2.1" fill="#b795ff"/>
</svg>`;

/* The press blurbs — warm and true, the spirit of the mission. */
const PRESS_ONELINER =
  "frens.earth gives anyone a free, sovereign @frens handle — your name, your keys, verified on nostr and tied to Bitcoin — from Pac's Arcade, a 501(c)(3) bitcoin-education non-profit.";

const PRESS_PARAGRAPH =
  "frens.earth is the home world of Pac's Arcade, a 501(c)(3) non-profit that teaches bitcoin the hands-on way. Claim a free @frens tag and it's yours forever: a name bound to keys only you hold, verifiable on nostr today and anchored to Bitcoin at the next batch — no rent, no resets, nobody to ask. Learn, play, and grow with your frens. Tick tock: everything gets tied to the block.";

/** Copy-to-clipboard button with an honest state machine: idle → copied ✓,
    or → copy failed when the clipboard API is blocked. Reverts after a beat. */
function CopyButton({
  value,
  label = "COPY",
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1600);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const tone =
    state === "copied"
      ? "border-neon text-neon"
      : state === "failed"
        ? "border-ghost text-ghost"
        : "border-edge text-white/70 hover:border-cyan hover:text-cyan";

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-live="polite"
      className={`font-pixel text-[10px] uppercase tracking-widest border-2 px-3 py-2 transition-colors motion-reduce:transition-none ${tone} ${className}`}
    >
      {state === "copied" ? "COPIED ✓" : state === "failed" ? "COPY FAILED" : label}
    </button>
  );
}

/**
 * The house SATOSHI mark — Candidate A, "THE STRUCK ESS": a lowercase gold s
 * pierced by ₿'s two vertical hash-bars. Composited inline (no font codepoint
 * exists for the satoshi), scales with font-size, wears coin gold because sats
 * ARE money. HOUSE PROPOSAL — pending the admiral's pick among four candidates.
 */
function SatMark({ style }: { style?: CSSProperties }) {
  const bar: CSSProperties = { top: "-0.16em", bottom: "-0.16em", width: "0.085em" };
  return (
    <span
      className="relative inline-block font-mono font-bold text-coin"
      style={{ padding: "0 0.07em", ...style }}
      role="img"
      aria-label="satoshi mark (house proposal — the struck ess)"
    >
      <span aria-hidden>s</span>
      <span aria-hidden className="absolute bg-current" style={{ ...bar, left: "0.22em" }} />
      <span aria-hidden className="absolute bg-current" style={{ ...bar, left: "0.40em" }} />
    </span>
  );
}

type Accent = { glyph: string; kicker: string };
const MONEY: Accent = { glyph: "text-coin glow-coin", kicker: "text-coin" };
const TIME: Accent = { glyph: "text-cyan", kicker: "text-cyan" };
const RAIL: Accent = { glyph: "text-neon", kicker: "text-neon" };

/** One copyable glyph: big mark, a one-line "what it is", and a COPY button. */
function GlyphCard({
  glyph,
  kicker,
  badge,
  note,
  copyValue,
  copyLabel,
  accent,
}: {
  glyph: ReactNode;
  kicker: string;
  badge?: string;
  note: string;
  copyValue: string;
  copyLabel: string;
  accent: Accent;
}) {
  return (
    <div className="flex flex-col items-center gap-3 border-2 border-edge bg-panel p-5 text-center">
      <span className="font-pixel text-[9px] uppercase tracking-widest">
        <span className={accent.kicker}>{kicker}</span>
        {badge ? <span className="text-white/40"> · {badge}</span> : null}
      </span>
      <div className={`flex h-20 items-center justify-center font-mono text-6xl leading-none ${accent.glyph}`}>
        {glyph}
      </div>
      <p className="min-h-[3.5em] font-body text-xs leading-snug text-white/60">{note}</p>
      <CopyButton value={copyValue} label={copyLabel} className="w-full" />
    </div>
  );
}

/** A palette swatch that copies its own hex — honest ✓ on the value line. */
function SwatchButton({ name, hex, role }: { name: string; hex: string; role: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const value = hex.toUpperCase();

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the value stays on screen to copy by hand */
    }
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-live="polite"
      className="group flex flex-col border-2 border-edge bg-panel p-2 text-left transition-colors hover:border-cyan motion-reduce:transition-none"
    >
      <span className="h-14 w-full border border-edge" style={{ backgroundColor: hex }} aria-hidden />
      <span className="mt-2 font-pixel text-[10px] uppercase text-white/80">{name}</span>
      <span className={`font-mono text-[10px] ${copied ? "text-neon" : "text-white/50"}`}>
        {copied ? "COPIED ✓" : value}
      </span>
      <span className="font-body text-[10px] text-white/40">{role}</span>
    </button>
  );
}

const t = frensEarthTheme.tokens;
const SWATCHES: ReadonlyArray<{ name: string; hex: string; role: string }> = [
  { name: "void", hex: t.void, role: "surface" },
  { name: "panel", hex: t.panel, role: "surface" },
  { name: "edge", hex: t.edge, role: "surface" },
  { name: "sprout", hex: t.neon, role: "live / success" },
  { name: "teal", hex: t.cyan, role: "info · verify" },
  { name: "coin", hex: t.coin, role: "money ONLY" },
  { name: "ghost", hex: t.ghost, role: "danger" },
  { name: "heart", hex: t.pink, role: "flair 💜" },
];

export default function MediaKit() {
  return (
    <>
      {/* Hero — informational, so no gold (gold is money only) */}
      <section className="px-6 pb-8 pt-14 text-center">
        <p className="font-pixel text-[10px] uppercase tracking-widest text-white/40">
          MEDIA / ASSETS
        </p>
        <h1 className="mt-4 font-arcade text-4xl leading-tight text-white sm:text-5xl">
          COPY A <span className="text-coin glow-coin">₿</span> WITHOUT LEAVING HOME
        </h1>
        <p className="mx-auto mt-6 max-w-xl font-body text-base text-white/70">
          House bitcoin glyphs, the frens.earth brand, and a press blurb — each one
          click to your clipboard. No trip to emojipedia required.
        </p>
      </section>

      {/* 1 — BITCOIN GLYPHS */}
      <section className="border-t border-dashed border-edge px-6 py-14">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-pixel text-sm text-cyan">BITCOIN GLYPHS</h2>
          <p className="mt-2 font-body text-sm text-white/60">
            Click to copy. <span className="text-coin">Gold is money</span> (the ₿ and the sat
            mark); <span className="text-cyan">cyan is time</span> (the date markers);{" "}
            <span className="text-neon">neon is the rail</span>.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <GlyphCard
              glyph="₿"
              kicker="MONEY"
              note="Bitcoin sign — Unicode U+20BF. The whole coin; 1 ₿ = 100,000,000 sats."
              copyValue="₿"
              copyLabel="COPY ₿"
              accent={MONEY}
            />
            <GlyphCard
              glyph={<SatMark />}
              kicker="MONEY"
              badge="PROPOSAL"
              note="Satoshi — the cent of bitcoin, 100,000,000 to the ₿. No Unicode exists; paste the word."
              copyValue="sats"
              copyLabel={'COPY "SATS"'}
              accent={MONEY}
            />
            <GlyphCard
              glyph="a₿"
              kicker="TIME"
              note="After-bitcoin date marker — rides after a BFT date: 0018.04.15 a₿."
              copyValue="a₿"
              copyLabel="COPY a₿"
              accent={TIME}
            />
            <GlyphCard
              glyph="b₿"
              kicker="TIME"
              note="Before-bitcoin marker — pre-genesis dates wear it the same way, after the date."
              copyValue="b₿"
              copyLabel="COPY b₿"
              accent={TIME}
            />
            <GlyphCard
              glyph="▣"
              kicker="TIME"
              note="Block marker — prefixes a height when the block itself matters: ▣ 957,661."
              copyValue="▣"
              copyLabel="COPY ▣"
              accent={TIME}
            />
            <GlyphCard
              glyph="⚡"
              kicker="RAIL"
              note="Lightning — the rail sats ride: instant, tiny, off-chain settlement."
              copyValue="⚡"
              copyLabel="COPY ⚡"
              accent={RAIL}
            />
          </div>

          <p className="mt-6 border-2 border-edge bg-panel p-4 font-body text-xs leading-relaxed text-white/50">
            <span className="font-pixel text-[10px] uppercase tracking-widest text-white/60">
              On the sat mark ·{" "}
            </span>
            The struck ess (<SatMark style={{ fontSize: "1.1em" }} />) is the house lead among
            four satoshi-mark candidates — a lowercase gold s wearing ₿&apos;s two hash-bars.
            It&apos;s a <span className="text-white/70">house proposal, pending the admiral&apos;s
            pick</span>, so the honest copyable value is the text fallback{" "}
            <span className="font-mono text-coin">sats</span> — the word wallets already print.
          </p>
        </div>
      </section>

      {/* 2 — HOUSE BRAND ASSETS */}
      <section className="border-t border-dashed border-edge px-6 py-14">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-pixel text-sm text-cyan">HOUSE BRAND ASSETS</h2>
          <p className="mt-2 font-body text-sm text-white/60">
            The mark, the wordmark, and the night-garden palette.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {/* The mark */}
            <div className="border-2 border-edge bg-panel p-6">
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/frens-mark.svg"
                  alt="frens.earth mark — a sprouting planet"
                  width={64}
                  height={64}
                  className="h-16 w-16 shrink-0"
                />
                <div>
                  <p className="font-pixel text-xs text-white">THE MARK</p>
                  <p className="mt-1 font-body text-xs leading-snug text-white/60">
                    A sprouting planet — a living earth, deliberately not a coin.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <a
                  href="/frens-mark.svg"
                  download="frens-mark.svg"
                  className="border-2 border-edge px-3 py-2 font-pixel text-[10px] uppercase tracking-widest text-white/70 transition-colors hover:border-cyan hover:text-cyan motion-reduce:transition-none"
                >
                  DOWNLOAD SVG
                </a>
                <CopyButton value={FRENS_MARK_SVG} label="COPY SVG" />
              </div>
            </div>

            {/* The wordmark */}
            <div className="flex flex-col justify-between border-2 border-edge bg-panel p-6">
              <div>
                <p className="font-pixel text-[9px] uppercase tracking-widest text-white/40">
                  THE WORDMARK
                </p>
                <p className="mt-3 font-arcade text-3xl text-white sm:text-4xl">FRENS.EARTH</p>
              </div>
              <div className="mt-5">
                <CopyButton value="FRENS.EARTH" label="COPY WORDMARK" />
              </div>
            </div>
          </div>

          {/* The palette */}
          <p className="mt-8 font-pixel text-[10px] uppercase tracking-widest text-white/50">
            THE PALETTE — CLICK A SWATCH TO COPY ITS HEX
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SWATCHES.map((s) => (
              <SwatchButton key={s.name} name={s.name} hex={s.hex} role={s.role} />
            ))}
          </div>

          <p className="mt-6 border-2 border-edge bg-panel p-4 font-body text-xs leading-relaxed text-white/50">
            <span className="font-pixel text-[10px] uppercase tracking-widest text-white/60">
              Usage ·{" "}
            </span>
            <span className="text-coin">Gold is money, and only money.</span> The earth&apos;s
            shape is never asserted — it&apos;s a mark, not a claim. And no Disney, ever.
          </p>
        </div>
      </section>

      {/* 3 — FOR PRESS */}
      <section className="border-t border-dashed border-edge px-6 py-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-pixel text-sm text-cyan">FOR PRESS</h2>
          <p className="mt-2 font-body text-sm text-white/60">
            Writing about us? Copy and paste — it&apos;s warm and it&apos;s true.
          </p>

          <div className="mt-8 space-y-6">
            <div className="border-2 border-edge bg-panel p-6">
              <p className="font-pixel text-[9px] uppercase tracking-widest text-white/40">
                ONE-LINER
              </p>
              <blockquote className="mt-3 font-body text-base leading-relaxed text-white/80">
                {PRESS_ONELINER}
              </blockquote>
              <div className="mt-5">
                <CopyButton value={PRESS_ONELINER} label="COPY ONE-LINER" />
              </div>
            </div>

            <div className="border-2 border-edge bg-panel p-6">
              <p className="font-pixel text-[9px] uppercase tracking-widest text-white/40">
                SHORT PARAGRAPH
              </p>
              <blockquote className="mt-3 font-body text-base leading-relaxed text-white/80">
                {PRESS_PARAGRAPH}
              </blockquote>
              <div className="mt-5">
                <CopyButton value={PRESS_PARAGRAPH} label="COPY PARAGRAPH" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
