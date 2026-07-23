"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { bftTime } from "@/lib/bb/bft";

/**
 * The split-flap BFT flip clock — ONE build for the mini corner badge and
 * the /time hero (sized by the parent's font-size; all card dims are em).
 *
 * The pupil study's laws (studies/clock-study-pupil.html), followed here:
 *  - "big mechanical flip digits show hh:mm. ONLY the LIVE minute-ones
 *    digit — THE STRUGGLING DIGIT (how full the current block is, in
 *    tenths) — struggles AT its flip … then FLIPS fully (snap)".
 *  - "The hours and minute-tens are calm flip cards that flip cleanly
 *    ONLY when they actually change (on a block)."
 *  - "the colon holds steady".
 *  - the live card "wears an honest ~" — blocks are random, the tenth
 *    is an estimate; the tens/hours are chain-exact, never marked.
 *  - prefers-reduced-motion → the flip is a plain crossfade (CSS).
 *
 * hh:mm comes from bftTime() (bft.ts) — the canonical beat→time mapping,
 * never re-derived. bftTime()'s minute-ones is always 0 (time steps by
 * ten per block); the live ones card REPLACES that 0 with the mempool
 * fill in tenths — the badge's own long-standing fill signal (vsize vs
 * one block through /api/chain/tip), so the minute reads like a climbing
 * clock but every mark maps to a chain fact.
 */

function FlipCard({ value, live }: { value: string; live?: boolean }) {
  const [flipping, setFlipping] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setFlipping(true); // the card's value really changed → one snap flip
    const t = setTimeout(() => setFlipping(false), 600);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <span
      className={`fclk-card${live ? " fclk-live" : ""}${flipping ? " fclk-flipping" : ""}`}
    >
      <span className="fclk-val">{value}</span>
      {live && <span className="fclk-est">~</span>}
    </span>
  );
}

export default function FlipClock({
  height,
  fill,
  className,
}: {
  height: number;
  /** mempool fullness vs one block, 0..1 — drives the struggling digit + its strain */
  fill: number;
  className?: string;
}) {
  const [hh, mm] = bftTime(height).split(":");
  const tenth = Math.min(9, Math.max(0, Math.floor(fill * 10)));

  return (
    <span
      className={`fclk ${className ?? ""}`}
      style={{ "--fclk-strain": fill.toFixed(2) } as CSSProperties}
      role="timer"
      aria-label={`Bitcoin Federated Time ${hh}:${mm[0]}${tenth} (last digit estimated)`}
    >
      <FlipCard value={hh[0]} />
      <FlipCard value={hh[1]} />
      <span className="fclk-colon">:</span>
      <FlipCard value={mm[0]} />
      <FlipCard value={String(tenth)} live />
    </span>
  );
}
