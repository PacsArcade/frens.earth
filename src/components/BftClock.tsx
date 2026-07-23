"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { currentBlockInfo, BLOCKS_PER_DAY, bft, type BlockInfo } from "@/lib/bb/bft";
import FlipClock from "@/components/time/FlipClock";

/**
 * Bitcoin Federated Time clock — THE TIME DOOR. The floating corner badge
 * is now a MINI split-flap FLIP CLOCK per the pupil study's rules
 * (studies/clock-study-pupil.html — see FlipClock.tsx for the laws), and
 * the whole badge is a door: click it and /time opens — the clock large,
 * the paper, and the experiment. The clock is the first lesson.
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
  const { year, month, day } = bft(height);
  const beat = height % BLOCKS_PER_DAY; // 0–143

  const pad2 = (n: number) => String(n).padStart(2, "0");

  return (
    /* docked bottom-right so the login dropdown never covers it (Pac flagged the
       top-corner clock hiding behind the open menu, 0018.04.16 a₿); persistent on
       every page. The btc-orange ring is the mempool filling toward the next block;
       it pulses when the block breaks. The whole badge is the TIME DOOR. */
    <Link
      href="/time"
      title="open the clock"
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
      <span className="block rounded-md border border-edge/80 bg-panel/95 px-3 py-2.5 backdrop-blur-sm">
        {/* Header */}
        <span className="mb-1.5 block text-center font-mono text-[7px] uppercase tracking-[0.25em] text-cyan/70">
          ⧗ BITCOIN TIME CLOCK
        </span>

        {/* HH:MM — the mini split-flap face (FlipClock: calm chain-exact cards
            + the one struggling ones digit wearing the honest ~) */}
        <span className="flex justify-center font-mono text-[24px]">
          <FlipClock height={height} fill={fill} />
        </span>

        {/* Date — the ₿-marked bitcoin date, marker after (house standard) */}
        <span className="mt-1.5 block text-center font-mono text-[10px] tracking-[0.18em] text-white/75 tabular-nums">
          {String(year).padStart(4, "0")}.{pad2(month)}.{pad2(day)}{" "}
          <span className="text-coin/80 tracking-normal">a₿</span>
        </span>

        {/* Sub-label: beat + height — a ~estimate wears the honest ~ */}
        <span className="mt-1 block text-center font-mono text-[7px] tabular-nums text-white/25">
          beat {String(beat).padStart(3, "0")}/144 · ★{estimated ? "~" : ""}
          {height.toLocaleString()}
        </span>

        {/* the door's handle */}
        <span className="mt-1 block text-center font-mono text-[6px] uppercase tracking-[0.3em] text-coin/60">
          open the clock ▸
        </span>
      </span>
    </Link>
  );
}
