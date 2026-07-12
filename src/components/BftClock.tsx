"use client";

import { useEffect, useRef, useState } from "react";
import { currentBlock, BLOCKS_PER_DAY, bft } from "@/lib/bb/bft";

/**
 * Bitcoin Federated Time clock — date + time displayed in familiar HH:MM format.
 *
 * The key insight: 144 blocks/day ÷ 24 = exactly 6 blocks per "Bitcoin hour".
 * Each block advances the minutes by 10 (00 → 10 → 20 → 30 → 40 → 50 → next hour).
 * So the time display ticks every ~10 real minutes and shows 00–23 for hours,
 * making it instantly readable as a normal clock. Every node worldwide agrees on
 * the same reading — block height IS the timestamp.
 * Fixed to the corner of every page; refreshes each minute.
 */
export default function BftClock() {
  const [height, setHeight] = useState<number | null>(null);
  const [breaking, setBreaking] = useState(false);
  const [fill, setFill] = useState(0); // real mempool fullness vs one block, 0..1
  const prev = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      currentBlock().then((h) => {
        if (!alive) return;
        /* the block breaks — pulse bitcoin orange around the clock (Pac,
           0018.04.15 a₿). First reading never pulses; only a NEW block does. */
        if (prev.current != null && h > prev.current) {
          setBreaking(true);
          setTimeout(() => alive && setBreaking(false), 4000);
        }
        prev.current = h;
        setHeight(h);
      });
      /* the ring fills like the mempool fills (Pac): live vsize against one
         block's worth (~1 MvB). Full ring = the next block is packed.
         Tick tock, it all comes back to the block. */
      fetch("https://mempool.space/api/mempool", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((m) => {
          if (alive && m && typeof m.vsize === "number") {
            setFill(Math.max(0.02, Math.min(1, m.vsize / 1_000_000)));
          }
        })
        .catch(() => {
          /* offline → the ring simply holds its last reading */
        });
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (height == null) return null;

  const { year, month, day } = bft(height);

  // 144 blocks/day ÷ 24 hours = 6 blocks per Bitcoin hour (exactly)
  const beat      = height % BLOCKS_PER_DAY;   // 0–143
  const btcHour   = Math.floor(beat / 6);       // 0–23  — the "hour hand"
  const btcMin    = (beat % 6) * 10;            // 0,10,20,30,40,50 — the "minute hand"

  const pad2 = (n: number) => String(n).padStart(2, "0");

  return (
    /* docked where the old block ticker lived — top corner, under the login
       menu; persistent on every page. The btc-orange ring is the mempool
       filling toward the next block; it pulses when the block breaks. */
    <div
      className={`fixed right-3 top-[88px] z-40 select-none rounded-lg sm:top-[104px] ${
        breaking ? "block-break" : ""
      }`}
      style={{
        padding: 2,
        background: `conic-gradient(from -90deg, rgba(247,147,26,0.95) ${fill * 360}deg, rgba(247,147,26,0.12) 0deg)`,
        boxShadow: `0 0 ${8 + 18 * fill}px rgba(247,147,26,${0.18 + 0.3 * fill})`,
      }}
      title={`Bitcoin Time Clock — the calendar that syncs to the block, not the sun. The orange ring is the live mempool filling toward the next block (${Math.round(fill * 100)}% of one block queued). Tick tock, it all comes back to the block.`}
    >
      <div className="rounded-md border border-edge/80 bg-panel/95 px-3 py-2.5 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-1.5 text-center text-[7px] uppercase tracking-[0.25em] text-cyan/70 font-mono">
        ⧗ BITCOIN TIME CLOCK
      </div>

      {/* Date — YR · MO · DY, each labelled */}
      <div className="flex items-end gap-1.5 font-mono">
        <Seg label="YR" value={String(year).padStart(4, "0")} dim />
        <span className="mb-0.5 text-[10px] text-white/25">·</span>
        <Seg label="MO" value={pad2(month)} />
        <span className="mb-0.5 text-[10px] text-white/25">·</span>
        <Seg label="DY" value={pad2(day)} />
      </div>

      {/* Divider */}
      <div className="my-1.5 h-px bg-white/10" />

      {/* HH:MM — the familiar clock face, derived from 144÷24=6 */}
      <div className="flex items-center justify-center gap-0.5 font-mono">
        <div className="flex flex-col items-center">
          <span className="text-[6px] uppercase tracking-widest text-white/30">HR</span>
          <span className="text-[20px] leading-none tabular-nums text-white">
            {pad2(btcHour)}
          </span>
        </div>
        {/* blinking colon */}
        <span className="mb-[-2px] text-[18px] font-bold text-coin/80 animate-pulse">:</span>
        <div className="flex flex-col items-center">
          <span className="text-[6px] uppercase tracking-widest text-white/30">MIN</span>
          <span className="text-[20px] leading-none tabular-nums text-white">
            {pad2(btcMin)}
          </span>
        </div>
      </div>

      {/* Sub-label: 6 blocks = 1 hour */}
      <div className="mt-1 text-center text-[7px] tabular-nums text-white/25 font-mono">
        beat {String(beat).padStart(3, "0")}/144 · ★{height.toLocaleString()}
      </div>
      </div>
    </div>
  );
}

/** A single labelled date segment — tiny label on top, value below. */
function Seg({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[6px] uppercase tracking-widest text-white/30">{label}</span>
      <span className={`text-[12px] leading-none tabular-nums ${dim ? "text-white/40" : "text-white/80"}`}>
        {value}
      </span>
    </div>
  );
}

