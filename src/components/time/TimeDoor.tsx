"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { currentBlockInfo, BLOCKS_PER_DAY, moonPhase, yearAnimal } from "@/lib/bb/bft";
import FlipClock from "@/components/time/FlipClock";
import Converters from "@/components/time/Converters";

/**
 * /time — the room behind the TIME DOOR. One live poll feeds everything:
 * the hero flip clock (large, flipping on real updates), the "watch a
 * block land" strip, and the converters' sense of "now". The paper rides
 * in as server-rendered children between the hero and the experiment.
 *
 * Same plumbing as the corner badge — currentBlockInfo() through the
 * fleet's own /api/chain/tip door (genesis-anchored ~ estimate when the
 * network is dark; the honest ~, never a fake pulse), mempool vsize vs
 * one block for the fill. The clock never stops.
 */
export default function TimeDoor({ children }: { children?: ReactNode }) {
  const [height, setHeight] = useState<number | null>(null);
  const [estimated, setEstimated] = useState(false);
  const [fill, setFill] = useState(0);
  const [breaking, setBreaking] = useState(false);
  const [landed, setLanded] = useState<number | null>(null); // last block seen landing, for the strip
  const prev = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      currentBlockInfo().then((i) => {
        if (!alive) return;
        /* only a NEW REAL block pulses — an ~estimate never fakes a break */
        if (!i.estimated) {
          if (prev.current != null && i.height > prev.current) {
            setBreaking(true);
            setLanded(i.height);
            setTimeout(() => alive && setBreaking(false), 4000);
          }
          prev.current = i.height;
        }
        setHeight(i.height);
        setEstimated(i.estimated);
      });
      fetch("/api/chain/tip", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && d?.ok && typeof d.mempoolVsize === "number") {
            setFill(Math.max(0.02, Math.min(1, d.mempoolVsize / 1_000_000)));
          }
        })
        .catch(() => {
          /* offline → the fill holds its last reading */
        });
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const beat = height == null ? null : height % BLOCKS_PER_DAY;
  const moon = height == null ? null : moonPhase(height);
  const animal = height == null ? null : yearAnimal(height);

  return (
    <>
      {/* ═══ THE HERO — the flip clock, large ═══ */}
      <section
        className={`mb-12 border-2 border-edge bg-panel/90 p-6 text-center sm:p-8 ${breaking ? "block-break" : ""}`}
        aria-label="The Bitcoin Federated Time flip clock"
      >
        {height == null ? (
          <p className="py-10 font-mono text-sm text-white/40">syncing to the chain…</p>
        ) : (
          <>
            {/* the face — `yyyy:mm:dd hh:mm a₿` (owner format ruling), LARGE;
                the date+time groups wrap into two flip rows on small screens */}
            <div className="flex justify-center font-mono text-[clamp(26px,6.8vw,46px)]">
              <FlipClock height={height} fill={fill} />
            </div>

            <p className="mt-4 font-mono text-xs tabular-nums text-white/45">
              beat {String(beat).padStart(3, "0")}/144 · ★{estimated ? "~" : ""}
              {height.toLocaleString()} · {moon!.emoji} {moon!.name} moon · year of the{" "}
              {animal!.emoji} {animal!.name}
            </p>

            {/* the honest status — live chain reading, or the ~ estimate */}
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em]">
              {estimated ? (
                <span className="text-coin/80">
                  ~ ESTIMATED — network unreachable, counting ~10 min a block from genesis
                </span>
              ) : (
                <span className="text-neon/80">● LIVE — read from the chain tip</span>
              )}
            </p>
          </>
        )}
      </section>

      {/* ═══ THE PAPER (server-rendered) ═══ */}
      {children}

      {/* ═══ THE EXPERIMENT ═══ */}
      <section className="mb-6" aria-label="The experiment">
        <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
          PART TWO ▸ THE EXPERIMENT
        </p>
        <h2 className="mb-3 font-pixel text-lg uppercase text-neon">Watch a block land</h2>
        <p className="mb-4 font-body text-sm text-white/70">
          This strip is live. The bar is the mempool — everyone&apos;s waiting
          payments — filling toward one block&apos;s worth of space. Leave this
          page open: when the next block lands, the clock above snaps its
          cards, the minute jumps by ten, and the height counts one more. That
          moment is the tick of the only clock the whole world agrees on.
        </p>

        <div className="border-2 border-edge bg-panel p-4">
          <div className="flex items-baseline justify-between font-mono text-xs text-white/70">
            <span>
              next block filling{" "}
              <b className="text-coin">~{Math.round(fill * 100)}%</b>
            </span>
            <span className="tabular-nums">
              tip ★{estimated ? "~" : ""}
              {height?.toLocaleString() ?? "—"}
            </span>
          </div>
          {/* the fill bar — the same signal as the badge's orange ring */}
          <div
            className="mt-2 h-3 border border-edge bg-void"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(fill * 100)}
            aria-label="Mempool filling toward one block"
          >
            <div
              className="h-full transition-[width] duration-1000"
              style={{
                width: `${Math.round(fill * 100)}%`,
                background: "linear-gradient(90deg, rgba(247,147,26,.55), #f7931a)",
              }}
            />
          </div>
          <p className="mt-2 font-mono text-[10px] text-white/40">
            {landed != null ? (
              <span className="text-neon">
                ★{landed.toLocaleString()} just landed — the clock advanced ten minutes. tick tock.
              </span>
            ) : estimated ? (
              <>~ the network is unreachable right now — the clock keeps counting on the honest estimate, and will snap true when the chain answers.</>
            ) : (
              <>a full bar doesn&apos;t force a block — miners find one every ~10 minutes on average, whenever the numbers allow. that randomness is why the last digit up there wears its ~.</>
            )}
          </p>
        </div>
      </section>

      {/* the two converters — your date, any block */}
      <Converters tip={height} tipEstimated={estimated} />
    </>
  );
}
