"use client";

import { useState } from "react";
import {
  GENESIS_MS,
  bftDate,
  beforeBitcoin,
  estimateHeight,
  moonPhase,
  yearAnimal,
} from "@/lib/bb/bft";

/**
 * The Bitcoin Birthday checker — convert an old-calendar birthday to BFT.
 *
 * Runs ENTIRELY in the browser: nothing typed here is sent anywhere, stored
 * anywhere, or seen by anyone. That's the lesson as much as the feature —
 * keys are consent; no keys, no data. The community calendar (captains and
 * up, signed opt-in, revocable) builds on this: docs/ships-calendar.md.
 */

interface Bday {
  preGenesis: boolean;
  height?: number;
  date: string;
  moon?: string;
  animal?: string;
}

function convert(value: string): Bday | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = Date.UTC(y, mo - 1, d, 12); // midday — safe center of the day
  if (utc < GENESIS_MS) {
    return { preGenesis: true, date: beforeBitcoin(y, mo, d) };
  }
  const height = estimateHeight(utc); // the ONE genesis-anchored estimator (bft.ts), ~10 min/block
  const moon = moonPhase(height);
  const animal = yearAnimal(height);
  return {
    preGenesis: false,
    height,
    date: bftDate(height),
    moon: `${moon.emoji} ${moon.name}`,
    animal: `${animal.emoji} ${animal.name}`,
  };
}

export default function BdayPage() {
  const [value, setValue] = useState("");
  const bday = value ? convert(value) : null;

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
        FRENS.EARTH ▸ THE BITCOIN BIRTHDAY CHECKER
      </p>
      <h1 className="mb-3 font-pixel text-xl uppercase text-neon">
        When were you born, in bitcoin time?
      </h1>
      <p className="mb-6 font-body text-sm text-white/70">
        The old calendar is burned — find your date on the new one. Pick your
        birthday and read it back in Bitcoin Federated Time: your block, your
        moon, your year-animal.
      </p>

      <label className="mb-6 block border-2 border-edge bg-panel p-4">
        <span className="mb-2 block font-pixel text-[9px] uppercase text-white/50">
          your old-calendar birthday
        </span>
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full border-2 border-edge bg-void px-3 py-2 font-mono text-sm text-cyan focus:border-cyan focus:outline-none"
        />
      </label>

      {bday && !bday.preGenesis && (
        <div className="mb-6 border-2 border-neon bg-neon/10 p-5">
          <p className="font-pixel text-[10px] uppercase text-white/50">your bitcoin birthday</p>
          {/* the date is height-derived, so it wears the honest ~ too */}
          <p className="mt-2 font-mono text-2xl text-neon">~ {bday.date}</p>
          <p className="mt-2 font-mono text-xs text-white/70">
            ▣ ~{bday.height!.toLocaleString()} — your birth block (estimated, ~10 min a block)
          </p>
          <p className="mt-1 font-mono text-xs text-white/70">
            moon: {bday.moon} · year of the {bday.animal}
          </p>
        </div>
      )}
      {bday && bday.preGenesis && (
        <div className="mb-6 border-2 border-heart bg-heart/10 p-5">
          <p className="font-pixel text-[10px] uppercase text-white/50">your bitcoin birthday</p>
          <p className="mt-2 font-mono text-2xl text-heart">{bday.date}</p>
          <p className="mt-2 font-body text-sm text-white/70">
            Born before the light — a ghost-side date. The chain counts you
            anyway; b₿ dates walk backward from block 0.
          </p>
        </div>
      )}

      <div className="border-2 border-edge bg-panel p-4">
        <p className="font-pixel text-[9px] uppercase text-cyan">no keys, no data</p>
        <p className="mt-2 font-body text-xs text-white/70">
          This page runs entirely in your browser — nothing you type leaves
          this device. When the community calendar opens (wallet birthdays,
          naming-day ceremonies), joining it will take your <b>signed
          consent</b>, and your key can revoke it at any time. Your keys are
          how consent works here: no signature, no data — and that includes
          when the data is bitcoin.
        </p>
      </div>
    </main>
  );
}
