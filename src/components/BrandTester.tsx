"use client";

import { useState } from "react";
import LoginPanel from "@/components/LoginPanel";
import EarthFooter from "@/components/EarthFooter";
import { BrandProvider, THEMES, frensTheme, type BrandTheme } from "@/lib/brand";

/**
 * The brand tester — where a candidate frens.earth identity gets worn by the
 * REAL components before it goes live. Pick a theme, read its swatches and
 * type, watch the actual sign-in render in it; flip COMPARE to hold it next
 * to what's live today. When the brand team's official items arrive they
 * fill the same BrandTheme slots and show up here first.
 */

const SWATCHES: { key: keyof BrandTheme["tokens"]; label: string; meaning: string }[] = [
  { key: "void", label: "VOID", meaning: "page surface" },
  { key: "panel", label: "PANEL", meaning: "card surface" },
  { key: "edge", label: "EDGE", meaning: "borders" },
  { key: "coin", label: "COIN", meaning: "money ONLY" },
  { key: "neon", label: "NEON", meaning: "live / success" },
  { key: "cyan", label: "CYAN", meaning: "info / verify" },
  { key: "ghost", label: "GHOST", meaning: "danger" },
  { key: "pink", label: "PINK", meaning: "flair 💜" },
];

/* What the brand team owes, mapped to where it lands — the handshake made
   concrete so "official design items" have a home waiting. */
const DELIVERABLES: [item: string, slot: string][] = [
  ["Logo + favicon", "public/ assets + ArcadeHeader marquee"],
  ["Banners / art", "page heroes (slots to be cut when art exists)"],
  ["Fonts", "BrandTheme.fonts (arcade / pixel / body / button)"],
  ["Colors", "BrandTheme.tokens (8 slots, semantic meanings locked)"],
  ["Accents & copy voice", "BrandTheme.copy + doors + the flair accent"],
];

function ThemeColumn({ theme, note }: { theme: BrandTheme; note: string }) {
  return (
    <BrandProvider theme={theme} className="min-w-0 flex-1 bg-void p-6">
      <div className="mx-auto max-w-md">
        <p className="mb-1 text-center font-pixel text-[10px] uppercase tracking-widest text-white/40">
          {note}
        </p>
        <p className="mb-5 text-center font-body text-xs text-white/50">{theme.label}</p>

        {/* swatch board — the eight slots and what they're allowed to mean */}
        <div className="mb-6 grid grid-cols-4 gap-2">
          {SWATCHES.map((s) => (
            <div key={s.key} className="border border-edge bg-panel p-2 text-center">
              <span
                aria-hidden
                className="mb-1 block h-6 w-full border border-white/10"
                style={{ backgroundColor: theme.tokens[s.key] }}
              />
              <p className="font-pixel text-[8px] uppercase text-white/70">{s.label}</p>
              <p className="font-body text-[9px] leading-tight text-white/40">{s.meaning}</p>
            </div>
          ))}
        </div>

        {/* type specimen — the three faces on this brand's surfaces */}
        <div className="mb-6 border-2 border-edge bg-panel p-4">
          <p className="font-arcade text-2xl text-coin glow-coin">DIGITAL RENAISSANCE</p>
          <p className="mt-1 font-pixel text-[10px] uppercase text-cyan">
            TICK TOCK — TIED TO THE BLOCK
          </p>
          <p className="mt-2 font-body text-sm text-white/75">
            We trust because we verify. Body copy stays calm, readable, glow-free.
          </p>
        </div>
      </div>

      {/* the real sign-in, wearing this brand */}
      <LoginPanel />
    </BrandProvider>
  );
}

export default function BrandTester() {
  const [themeId, setThemeId] = useState<string>("frens-earth");
  const [compare, setCompare] = useState(true);
  const theme = THEMES[themeId] ?? frensTheme;

  return (
    <main className="min-h-screen bg-void">
      <div className="border-b-2 border-edge px-6 py-5 text-center">
        <p className="mb-1 font-pixel text-[10px] uppercase tracking-widest text-white/40">
          FRENS.EARTH ▸ ADMIN ▸ BRAND TESTER
        </p>
        <h1 className="font-arcade text-3xl text-pink glow-pink">DRESSING ROOM</h1>
        <p className="mx-auto mt-2 max-w-xl font-body text-sm text-white/60">
          Real components, candidate brands. The placeholder wears the digital
          renaissance until the brand team&apos;s official items land in the same slots.
        </p>
      </div>

      {/* picker rail */}
      <div className="flex flex-wrap items-center justify-center gap-3 border-b-2 border-edge px-6 py-4">
        {Object.values(THEMES).map((t) => (
          <button
            key={t.id}
            onClick={() => setThemeId(t.id)}
            className={`border-2 px-3 py-1.5 font-pixel text-[10px] uppercase ${
              t.id === themeId
                ? "border-pink bg-pink/10 text-pink"
                : "border-edge text-white/50 hover:border-cyan hover:text-cyan"
            }`}
          >
            {t.id === "frens" ? "● LIVE TODAY — " : ""}
            {t.label}
          </button>
        ))}
        <label className="ml-2 flex cursor-pointer items-center gap-2 font-pixel text-[10px] uppercase text-white/50">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
            className="accent-[var(--color-pink)]"
          />
          COMPARE WITH LIVE
        </label>
      </div>

      {/* the fitting — selected brand, optionally next to today's look */}
      <div className="flex flex-col gap-2 lg:flex-row">
        <ThemeColumn theme={theme} note="◆ CANDIDATE" />
        {compare && theme.id !== "frens" && (
          <ThemeColumn theme={frensTheme} note="● LIVE TODAY" />
        )}
      </div>

      {/* the brand-team handshake */}
      <section className="mx-auto max-w-3xl px-6 py-10">
        <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
          WHAT THE BRAND TEAM DELIVERS — AND WHERE IT LANDS
        </p>
        <div className="border-2 border-edge bg-panel">
          {DELIVERABLES.map(([item, slot]) => (
            <div
              key={item}
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-edge px-4 py-3 last:border-b-0"
            >
              <span className="font-pixel text-[10px] uppercase text-cyan">{item}</span>
              <span className="font-body text-xs text-white/60">{slot}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 font-body text-xs text-white/50">
          Semantic slots stay honest whatever the palette: coin means money, neon means
          live, ghost means danger, cyan means info, pink is the one free accent. Free
          things stay free. 💜
        </p>
      </section>

      <EarthFooter />
    </main>
  );
}
