"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { bftDatePlain, currentBlockInfo } from "@/lib/bb/bft";
import {
  createStripClock,
  type StripClockEngine,
} from "@/components/time/strip-clock-engine";
import "./strip-clock.css";

/**
 * THE STRIP CLOCK — the pupil study's flip clock, flattened into the header's
 * telemetry strip (owner marked-up spec, 0018.04.27). It REPLACES the old
 * "■ BLOCK N" ticker via SiteHeader's tickerSlot: the height now rides
 * INSIDE the clock (the study's small HEIGHT caption), the flip cards read
 * hh:mm:ss (seconds added, ticking from the tip's chain timestamp), the date
 * line stays, and ALL the pacman rides the flat rectangle's border — pellet
 * track, fiat ghosts at their stations, the fruit/₿ prize, Pac lapping and
 * eating. Every explainer word from the study card is gone (the red X);
 * the whole strip is a door — click the clock, get /time.
 *
 * The frens.earth sibling of pacsarcade.org's strip (fleet law): the clock
 * FACE keeps the study skin whole — dark bed, cream digits, amber warmth —
 * and the BRAND shows only in the strip's frame/accent (the night-garden
 * edge + sprout-neon glow, strip-clock.css).
 *
 * The MoonClock split, exactly (react-compiler law): React renders the
 * static skeleton once and polls the seam; strip-clock-engine.ts drives
 * every moving part imperatively — no ref reads in render, no setState in
 * effect bodies. Data: currentBlockInfo() each minute — the fleet's OWN
 * /api/chain/tip?full=1 door first (node-first seam), public mempool tip as
 * client backup, the genesis-anchored honest ~ estimate last.
 */
export default function StripClock() {
  const rootRef = useRef<HTMLAnchorElement | null>(null);
  const engineRef = useRef<StripClockEngine | null>(null);
  const [info, setInfo] = useState<{
    height: number;
    estimated: boolean;
    tipTimestamp: number | null;
  } | null>(null);

  /* the data plumbing — the MoonClock badge's, plus THE WAKE LAW: hidden
     tabs get their timers suspended, so the moment this strip is looked at
     again (tab switch back, bfcache restore, the network returning) it
     re-knocks IMMEDIATELY — fresh past the 60 s client cache — instead of
     waiting out a stale interval. */
  useEffect(() => {
    let alive = true;
    const tick = (fresh = false) => {
      currentBlockInfo(fresh ? { fresh: true } : undefined).then((i) => {
        if (alive)
          setInfo({ height: i.height, estimated: i.estimated, tipTimestamp: i.tipTimestamp });
      });
    };
    tick();
    const id = setInterval(() => tick(), 60_000);
    const wake = () => {
      if (!document.hidden) tick(true);
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("pageshow", wake);
    window.addEventListener("online", wake);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("online", wake);
    };
  }, []);

  /* the engine — created once against the rendered DOM, destroyed on unmount */
  const ready = info != null;
  useEffect(() => {
    if (!ready) return;
    const root = rootRef.current;
    if (!root) return;
    const engine = createStripClock(root);
    engineRef.current = engine;
    return () => {
      engineRef.current = null;
      engine.destroy();
    };
  }, [ready]);

  /* every new reading flows to the engine */
  useEffect(() => {
    if (info != null) engineRef.current?.update(info);
  }, [info]);

  if (info == null) return null;

  const tilde = info.estimated ? "~" : "";
  return (
    <Link
      href="/time"
      ref={rootRef}
      className="sclk"
      title="Bitcoin Federated Time — the clock that syncs to the block, not the sun. Click it: the big clock and the paper live on /time."
      aria-label={`Bitcoin Federated Time strip clock — ${bftDatePlain(info.height)} a₿, height ${tilde}${info.height.toLocaleString("en-US")} — open the time page`}
    >
      <span className="sclk-card">
        {/* the flat pellet track: dots → ghosts → prize → Pac last, the
            study's paint order, driven whole by the engine */}
        <svg className="sclk-peri" aria-hidden="true">
          <path className="sclk-track" d="" />
          <g className="sclk-dots" />
          <g className="sclk-ghosts" />
          <g className="sclk-prize" />
          <image
            className="sclk-pac"
            href="/art/time/pac-tricolor.png"
            preserveAspectRatio="xMidYMid meet"
          />
        </svg>

        {/* the flip cards — hh:mm:ss; the seconds-ones is the live card and
            wears the study's honest ~ */}
        <span className="sclk-clock" role="timer" aria-label="Bitcoin Federated Time">
          <span className="flip">
            <span className="flip-val">–</span>
          </span>
          <span className="flip">
            <span className="flip-val">–</span>
          </span>
          <span className="flip-colon">:</span>
          <span className="flip">
            <span className="flip-val">–</span>
          </span>
          <span className="flip">
            <span className="flip-val">–</span>
          </span>
          <span className="flip-colon">:</span>
          <span className="flip">
            <span className="flip-val">–</span>
          </span>
          <span className="flip live">
            <span className="flip-val">–</span>
            <span className="flip-est" aria-hidden="true">
              ~
            </span>
          </span>
        </span>

        {/* the facts INSIDE the card — the study's HEIGHT caption + the date
            line ("date is fine"); no separate BLOCK text anywhere */}
        <span className="sclk-facts">
          <span className="sclk-height">
            HEIGHT <b className="sclk-h-num">—</b>
          </span>
          <span className="sclk-date">
            <span className="sclk-d-num">————.——.——</span> <span className="sclk-ab">
              a
              <svg className="sclk-btc" viewBox="0 0 10 14" aria-hidden="true">
                <path d="M2 2.6H6a2.1 2.1 0 0 1 0 4.2H2M2 6.8H6.6a2.3 2.3 0 0 1 0 4.6H2M2 2.6V11.4M3.8 0.6V2.6M6 0.6V2.6M3.8 11.4V13.4M6 11.4V13.4" />
              </svg>
            </span>
          </span>
          <span className="sclk-oldcal">OLD CAL · —</span>
        </span>
      </span>
    </Link>
  );
}
