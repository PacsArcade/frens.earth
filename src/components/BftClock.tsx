"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { currentBlockInfo, BLOCKS_PER_DAY, type BlockInfo } from "@/lib/bb/bft";
import FlipClock from "@/components/time/FlipClock";

/**
 * Bitcoin Federated Time clock — THE TIME DOOR. The floating corner badge
 * is now a MINI split-flap FLIP CLOCK per the pupil study's rules
 * (studies/clock-study-pupil.html — see FlipClock.tsx for the laws), and
 * the whole badge is a door: click it and /time opens — the clock large,
 * the paper, and the experiment. The clock is the first lesson.
 *
 * CLOCK HIERARCHY RULING (owner, binding): the TIME is the hero — the
 * flip cards BIG; the date small below, an afterthought. The header row
 * and the beat/★height microline are gone from the face — those facts
 * live in the hover tooltip now, honesty one hover away. (The struggling
 * digit keeps its honest ~ ON the face, per house law.)
 *
 * Pac orbits this badge too (ported from pacsarcade.org — the pupil-study
 * lap law, scale-honest mini): TEN laps per block, one lap per
 * block-tenth, ~60 s a lap at the ten-minute pace, riding the border on a
 * CSS offset-path (`.bft-pac` in globals.css). Keying the img on the
 * height re-anchors the lap phase whenever a new block lands. Under
 * prefers-reduced-motion (or without offset-path support) Pac parks,
 * visible and still, on the top-right corner.
 *
 * The data plumbing is unchanged: height via currentBlockInfo() (the
 * fleet's own /api/chain/tip door, honest ~ estimate fallback), mempool
 * fill vs one block for the ring + the struggling digit, refresh each
 * minute, and the block-break pulse ONLY on a new REAL block — a genesis
 * ~estimate never fakes a break.
 * Fixed to the corner of every page (stands down inside /a — the console
 * tray-clock carries time there — and on /time itself, where the hero IS
 * the clock; time never shows twice).
 */
export default function BftClock() {
  const pathname = usePathname();
  const [info, setInfo] = useState<BlockInfo | null>(null);
  const [breaking, setBreaking] = useState(false);
  const [fill, setFill] = useState(0); // real mempool fullness vs one block, 0..1
  const prev = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      currentBlockInfo().then((i) => {
        if (!alive) return;
        /* the block breaks — pulse bitcoin orange around the clock (Pac,
           0018.04.15 a₿). First reading never pulses; only a NEW REAL block
           does — a genesis ~estimate never fakes a break. */
        if (!i.estimated) {
          if (prev.current != null && i.height > prev.current) {
            setBreaking(true);
            setTimeout(() => alive && setBreaking(false), 4000);
          }
          prev.current = i.height;
        }
        setInfo(i);
      });
      /* the ring fills like the mempool fills (Pac): live vsize against one
         block's worth (~1 MvB). Full ring = the next block is packed.
         Tick tock, it all comes back to the block. Reads through the fleet's
         own door — /api/chain/tip, the admiral's configured node — not
         mempool.space directly (sovereignty fix, 2026-07-11). */
      fetch("/api/chain/tip", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && d?.ok && typeof d.mempoolVsize === "number") {
            setFill(Math.max(0.02, Math.min(1, d.mempoolVsize / 1_000_000)));
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

  /* inside the operator console the SCAR·LET shell carries the ONE BFT
     tray-clock (ribbon foot on desktop, bottom elbow bar on mobile) — the
     floating bubble stands down there so time never shows twice */
  if (pathname === "/a" || pathname.startsWith("/a/")) return null;

  /* on /time the hero IS this clock, large — the badge stands down */
  if (pathname === "/time") return null;

  if (info == null) return null;

  const { height, estimated } = info;
  const beat = height % BLOCKS_PER_DAY; // 0–143

  return (
    /* docked bottom-right so the login dropdown never covers it (Pac flagged the
       top-corner clock hiding behind the open menu, 0018.04.16 a₿); persistent on
       every page. The btc-orange ring is the mempool filling toward the next block;
       it pulses when the block breaks. The whole badge is the TIME DOOR. */
    <Link
      href="/time"
      title={`open the clock — Bitcoin Federated Time · beat ${String(beat).padStart(3, "0")}/144 · block ★${estimated ? "~" : ""}${height.toLocaleString()}${estimated ? " (~ genesis-anchored estimate — network unreachable)" : ""}`}
      aria-label="open the clock — Bitcoin Federated Time: the flip clock, the paper, the experiment"
      className={`fixed bottom-3 right-3 z-40 block select-none rounded-lg ${
        breaking ? "block-break" : ""
      }`}
      style={{
        padding: 2,
        background: `conic-gradient(from -90deg, rgba(247,147,26,0.95) ${fill * 360}deg, rgba(247,147,26,0.12) 0deg)`,
        boxShadow: `0 0 ${8 + 18 * fill}px rgba(247,147,26,${0.18 + 0.3 * fill})`,
      }}
    >
      {/* Pac laps the badge ten times per block — one lap per block-tenth,
          ~60 s at the ten-minute pace. The height key snaps the lap phase
          to zero each time a new block is observed; between blocks the
          orbit runs on wall time, smooth and constant. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- 14px pixel sprite; plain img like the org */}
      <img
        key={height}
        src="/art/pac-trip.png"
        alt=""
        aria-hidden="true"
        className="bft-pac"
      />
      <span className="block rounded-md border border-edge/80 bg-panel/95 px-3 py-2.5 backdrop-blur-sm">
        {/* the face — TIME the hero: big flip cards (hh:m + the struggling
            ones digit wearing the honest ~), the yyyy:mm:dd date tiny and
            dim below (clock hierarchy ruling) */}
        <span className="flex justify-center font-mono text-[28px]">
          <FlipClock height={height} fill={fill} />
        </span>

        {/* the door's handle */}
        <span className="mt-1 block text-center font-mono text-[6px] uppercase tracking-[0.3em] text-coin/60">
          open the clock ▸
        </span>
      </span>
    </Link>
  );
}
