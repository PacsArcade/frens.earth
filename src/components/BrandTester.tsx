"use client";

import { useState } from "react";
import LoginPanel from "@/components/LoginPanel";
import EarthFooter from "@/components/EarthFooter";
import { BrandProvider, THEMES, frensTheme, type BrandTheme } from "@/lib/brand";

/**
 * The brand tester — where a candidate frens.earth identity gets worn by the
 * REAL components before it goes live. Pick a brand from the TEMPLATE TILES
 * (the approved wireframe's "3 templates + custom" grammar: name, live tag,
 * one-line sub, the five-swatch strip), read its swatches and type, watch the
 * actual sign-in render in it; flip COMPARE to hold it next to what's live
 * today. Typography follows the approved scar-lcars-wireframe Dressing Room:
 * big section heads, 12px-scale labels — never the old 8–10px squint.
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

/** the tile's five-swatch strip — the semantic accents, in lock order */
const STRIP: (keyof BrandTheme["tokens"])[] = ["coin", "neon", "cyan", "ghost", "pink"];

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
        <p className="mb-5 text-center font-body text-sm text-white/55">{theme.label}</p>

        {/* swatch board — the eight slots and what they're allowed to mean */}
        <div className="mb-6 grid grid-cols-4 gap-2.5">
          {SWATCHES.map((s) => (
            <div key={s.key} className="rounded-lg border border-edge bg-panel p-2.5 text-center">
              <span
                aria-hidden
                className="mb-1.5 block h-8 w-full rounded border border-white/10"
                style={{ backgroundColor: theme.tokens[s.key] }}
              />
              <p className="font-pixel text-[10px] uppercase text-white/80">{s.label}</p>
              <p className="font-body text-[11px] leading-tight text-white/45">{s.meaning}</p>
            </div>
          ))}
        </div>

        {/* type specimen — the three faces on this brand's surfaces */}
        <div className="mb-6 rounded-xl border-2 border-edge bg-panel p-5">
          <p className="font-arcade text-2xl text-coin glow-coin">DIGITAL RENAISSANCE</p>
          <p className="mt-1.5 font-pixel text-xs uppercase text-cyan">
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

/** One template tile — the wireframe's .tmpl card: name + live tag, the
    one-line sub, the five-swatch strip. The tile IS the picker. */
function TemplateTile({
  theme,
  active,
  onPick,
}: {
  theme: BrandTheme;
  active: boolean;
  onPick: () => void;
}) {
  const live = theme.id === "frens";
  return (
    <button
      onClick={onPick}
      aria-pressed={active}
      data-accent="pink"
      className={`console-card console-card--hover flex w-full flex-col gap-1.5 p-4 text-left ${
        active ? "console-card--active" : ""
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <b className="font-pixel text-xs uppercase leading-snug text-white/90">{theme.label}</b>
        {live && (
          <span className="whitespace-nowrap font-pixel text-[9px] uppercase tracking-widest text-neon">
            ● LIVE
          </span>
        )}
        {active && !live && (
          <span className="whitespace-nowrap font-pixel text-[9px] uppercase tracking-widest text-pink">
            ◆ WORN
          </span>
        )}
      </span>
      <span className="font-body text-xs text-white/50">
        {live ? "what the site wears today" : "a candidate look, worn by the real components"}
      </span>
      <span aria-hidden className="mt-1.5 flex gap-1">
        {STRIP.map((k) => (
          <i
            key={k}
            className="h-2.5 flex-1 rounded-sm border border-white/10"
            style={{ backgroundColor: theme.tokens[k] }}
          />
        ))}
      </span>
    </button>
  );
}

export default function BrandTester() {
  const [themeId, setThemeId] = useState<string>("frens-earth");
  const [compare, setCompare] = useState(true);
  const theme = THEMES[themeId] ?? frensTheme;

  return (
    <main className="bg-void">
      {/* BRAND KIT — the room's second panel (the page head above carries the
          DRESSING ROOM title at the approved wireframe scale) */}
      <div className="mx-auto max-w-5xl px-6 pb-6 pt-10">
        <p className="lcars-eyebrow mb-3" data-accent="pink">
          THE FITTING · ONE SURFACE — MEANINGS LOCKED 🔒
        </p>
        <h2 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">BRAND KIT</h2>
        <p className="max-w-2xl font-body text-sm text-white/55">
          Real components, candidate brands. Pick a template tile and the actual sign-in wears it;
          the placeholder wears the digital renaissance until the brand team&apos;s official items
          land in the same slots. The captain owns the hues — the console owns the meanings.
        </p>

        {/* the template tiles — the wireframe's 4-up template grid */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Object.values(THEMES).map((t) => (
            <TemplateTile
              key={t.id}
              theme={t}
              active={t.id === themeId}
              onPick={() => setThemeId(t.id)}
            />
          ))}
        </div>
        <label className="mt-4 flex w-fit cursor-pointer items-center gap-2.5 font-pixel text-[10px] uppercase tracking-widest text-white/55">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-pink)]"
          />
          COMPARE WITH LIVE
        </label>
      </div>

      {/* the fitting — selected brand, optionally next to today's look */}
      <div className="flex flex-col gap-2 border-t-2 border-edge lg:flex-row">
        <ThemeColumn theme={theme} note="◆ CANDIDATE" />
        {compare && theme.id !== "frens" && (
          <ThemeColumn theme={frensTheme} note="● LIVE TODAY" />
        )}
      </div>

      {/* the brand-team handshake */}
      <section className="mx-auto max-w-3xl px-6 py-10">
        <p className="lcars-eyebrow mb-4" data-accent="pink">
          WHAT THE BRAND TEAM DELIVERS — AND WHERE IT LANDS
        </p>
        <div className="console-card overflow-hidden">
          {DELIVERABLES.map(([item, slot]) => (
            <div
              key={item}
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-edge px-4 py-3 last:border-b-0"
            >
              <span className="font-pixel text-xs uppercase text-cyan">{item}</span>
              <span className="font-body text-xs text-white/60">{slot}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 font-body text-sm text-white/55">
          Semantic slots stay honest whatever the palette: coin means money, neon means live,
          ghost means danger, cyan means info, pink is the one free accent. Free things stay
          free. 💜
        </p>
      </section>

      <EarthFooter />
    </main>
  );
}
