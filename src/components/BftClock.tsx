"use client";

import { useEffect, useState } from "react";
import { bftDate, currentBlock, BLOCKS_PER_DAY } from "@/lib/bb/bft";

/**
 * A persistent Bitcoin Federated Time clock — the date + "time" (the beat: which
 * of the day's 144 blocks we're on) rendered in the ₿-marked BFT standard,
 * `a₿ yyyy.mm.dd`. Block height IS the timestamp, so it's the same clock every
 * node agrees on. Fixed to the corner of every page; refreshes each minute.
 */
export default function BftClock() {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => currentBlock().then((h) => { if (alive) setHeight(h); });
    tick();
    const id = setInterval(tick, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (height == null) return null;

  const date = bftDate(height); // "a₿ 0018.04.14"
  const beat = height % BLOCKS_PER_DAY; // 0–143 — the block within the BFT day
  const i = date.indexOf("₿");

  return (
    <div
      className="fixed bottom-3 right-3 z-40 select-none rounded-md border border-edge/80 bg-panel/80 px-3 py-2 text-right font-mono leading-tight text-white/70 shadow-lg backdrop-blur-sm"
      title="Bitcoin Federated Time — the calendar that syncs to the block"
    >
      <div className="text-[8px] uppercase tracking-[0.22em] text-cyan/70">⧗ Bitcoin Time</div>
      <div className="mt-0.5 text-[12px] text-white">
        {date.slice(0, i)}
        <span className="text-[1.2em] text-coin">₿</span>
        {date.slice(i + 1)}
      </div>
      <div className="text-[9px] tabular-nums text-white/45">
        beat {String(beat).padStart(3, "0")}/144 · ★{height.toLocaleString()}
      </div>
    </div>
  );
}
