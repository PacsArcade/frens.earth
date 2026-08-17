"use client";

import { useState } from "react";
import {
  GENESIS_MS,
  bftDate,
  bftDateTime,
  beforeBitcoin,
  estimateHeightAt,
  moonPhase,
  yearAnimal,
  BLOCKS_PER_DAY,
} from "@/lib/bb/bft";

/**
 * The /time converters — the hands-on half of the experiment. Everything
 * runs in the browser; nothing typed here leaves the device (same promise
 * as /bday). All math is the site's own bft.ts helpers — never re-derived.
 *
 * Two doors:
 *  - a day from the calendar you were handed → its BFT date. Wall-clock →
 *    height is an estimate (~10 min a block), so it wears the honest ~.
 *    Every answer also carries its ~block height (NEGATIVE pre-genesis)
 *    and the study's Act-III dating: "~N blocks before/after the light ·
 *    b₿/a₿" (owner order — the same honest language as the orrery).
 *  - a block height → its BFT stamp. Height → date is pure arithmetic —
 *    exact, no ~ ever. A height above the tip isn't mined yet: its date is
 *    already certain, the wall-day it lands on is not. That asymmetry IS
 *    the lesson.
 */

function DateResult({ value, tip }: { value: string; tip: number | null }) {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = Date.UTC(y, mo - 1, d, 12); // midday — safe center of the day

  if (utc < GENESIS_MS) {
    /* pre-genesis reads NEGATIVE — the ~block height on the ghost side,
       and the honest Act-III phrasing: blocks before the light */
    const before = Math.floor((GENESIS_MS - utc) / 600_000);
    return (
      <div className="mt-3 border-2 border-heart bg-heart/10 p-4">
        <p className="font-mono text-xl text-heart">{beforeBitcoin(y, mo, d)}</p>
        <p className="mt-2 font-mono text-xs tabular-nums text-white/70">
          <span className="whitespace-nowrap">~block −{before.toLocaleString()}</span> ·{" "}
          <span className="whitespace-nowrap">~{before.toLocaleString()} blocks before the light</span>{" "}
          · <span className="whitespace-nowrap">b₿</span>
        </p>
        <p className="mt-2 text-pretty font-body text-xs text-white/70">
          Before the first block — a ghost-side date. b₿ dates walk backward
          from block 0; the chain counts you anyway.
        </p>
      </div>
    );
  }

  const height = estimateHeightAt(utc, tip); // anchored: halvings + the live tip (bft.ts)
  const moon = moonPhase(height, utc); // the date's own instant → its real moon
  const animal = yearAnimal(height);
  return (
    <div className="mt-3 border-2 border-neon bg-neon/10 p-4">
      {/* height-derived from a wall clock → the honest ~ on every line */}
      <p className="font-mono text-xl text-neon">~ {bftDate(height)}</p>
      <p className="mt-2 font-mono text-xs tabular-nums text-white/70">
        <span className="whitespace-nowrap">★~{height.toLocaleString()}</span> — the nearest
        block (estimated, <span className="whitespace-nowrap">~10 min</span> a block)
      </p>
      <p className="mt-1 font-mono text-xs tabular-nums text-white/70">
        <span className="whitespace-nowrap">~block {height.toLocaleString()}</span> ·{" "}
        <span className="whitespace-nowrap">a₿</span> —{" "}
        <span className="whitespace-nowrap">~{height.toLocaleString()} blocks</span> after the
        light
      </p>
      <p className="mt-1 font-mono text-xs text-white/70">
        moon: {moon.emoji} {moon.name} · year of the {animal.emoji} {animal.name}
      </p>
    </div>
  );
}

function HeightResult({ raw, tip, tipEstimated }: { raw: string; tip: number | null; tipEstimated: boolean }) {
  const h = Number(raw.replace(/[,.\s_]/g, ""));
  if (!Number.isInteger(h) || h < 0) {
    return <p className="mt-3 font-mono text-xs text-white/40">enter a block height — a whole number, 0 or more</p>;
  }
  const moon = moonPhase(h);
  const animal = yearAnimal(h);
  const beat = h % BLOCKS_PER_DAY;
  const future = tip != null && !tipEstimated && h > tip;
  return (
    <div className="mt-3 border-2 border-cyan bg-cyan/10 p-4">
      {/* height → date is pure block math — EXACT, never a ~ */}
      <p className="font-mono text-xl text-cyan">
        <span className="whitespace-nowrap">{bftDateTime(h)} <span className="text-white/50">a₿</span></span>
      </p>
      <p className="mt-2 font-mono text-xs tabular-nums text-white/70">
        <span className="whitespace-nowrap">★{h.toLocaleString()}</span> ·{" "}
        <span className="whitespace-nowrap">beat {String(beat).padStart(3, "0")}/144</span> ·
        moon: {moon.emoji} {moon.name} · year of the {animal.emoji} {animal.name}
      </p>
      <p className="mt-2 font-body text-xs text-white/60">
        {future ? (
          <>
            That block hasn&apos;t been mined yet — and its BFT date is
            <b> already certain</b>. Which day it lands on the old calendar,
            nobody on earth can tell you. That&apos;s the whole idea.
          </>
        ) : (
          <>
            Exact — no ~. A height is a recorded fact every node agrees on,
            so its date is arithmetic, not an estimate.
          </>
        )}
      </p>
    </div>
  );
}

export default function Converters({ tip, tipEstimated }: { tip: number | null; tipEstimated: boolean }) {
  const [dateValue, setDateValue] = useState("");
  const [heightValue, setHeightValue] = useState("");

  return (
    <section aria-label="The converters">
      <h2 className="mb-3 text-balance font-pixel text-lg uppercase text-neon">
        Try the calendar yourself
      </h2>
      <p className="mb-4 text-pretty font-body text-sm text-white/70">
        Both converters run entirely in your browser — nothing you type
        leaves this device. Notice which answers wear the ~ and which
        don&apos;t: that little mark is the calendar telling you the truth
        about what it knows.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* old-calendar day → BFT */}
        <label className="block border-2 border-edge bg-panel p-4">
          <span className="mb-2 block font-pixel text-[9px] uppercase text-white/50">
            a day from the old calendar
          </span>
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="w-full border-2 border-edge bg-void px-3 py-2 font-mono text-sm text-cyan focus:border-cyan focus:outline-none"
          />
          {dateValue && <DateResult value={dateValue} tip={tip} />}
          <span className="mt-2 block font-mono text-[10px] text-white/35">
            a wall-clock day → the nearest block is an ~estimate. your
            birthday gets the full ceremony at /bday.
          </span>
        </label>

        {/* block height → BFT stamp */}
        <label className="block border-2 border-edge bg-panel p-4">
          <span className="mb-2 block font-pixel text-[9px] uppercase text-white/50">
            any block height
          </span>
          <input
            type="text"
            inputMode="numeric"
            placeholder={tip != null ? `e.g. ${tip.toLocaleString()}` : "e.g. 840,000"}
            value={heightValue}
            onChange={(e) => setHeightValue(e.target.value)}
            className="w-full border-2 border-edge bg-void px-3 py-2 font-mono text-sm text-cyan placeholder:text-white/25 focus:border-cyan focus:outline-none"
          />
          {heightValue && <HeightResult raw={heightValue} tip={tip} tipEstimated={tipEstimated} />}
          <span className="mt-2 block font-mono text-[10px] text-white/35">
            a height → its stamp is exact block math. try 0 (the first
            morning) or a height above the tip (the already-certain future).
          </span>
        </label>
      </div>
    </section>
  );
}
