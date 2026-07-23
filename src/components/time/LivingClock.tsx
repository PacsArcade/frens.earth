"use client";

import { useEffect, useRef, useState } from "react";
import {
  createLivingClock,
  type LivingClockEngine,
  type LivingTip,
} from "@/components/time/living-clock-engine";
import "./living-clock.css";

/**
 * THE LIVING CLOCK — the pupil study's square flip clock, whole, as the
 * /time hero (owner order: "the regular clock — INTERACTIVE. They want to
 * WATCH it. They want to see the numbers SHAKE. And pacman go around and
 * EAT ALL THE FIAT.").
 *
 * The markup below is the study's own card (studies/clock-study-pupil.html,
 * rev 7) re-expressed as JSX; everything that MOVES — the ring, Pac's chomp,
 * the fiat ghosts, the fruit ladder, the flip digits, the tremble, the ember
 * breath, the Day-0 countdown — is driven imperatively by the ported engine
 * (living-clock-engine.ts) against refs, in one effect-owned rAF loop. React
 * owns only the static structure and the card FLIP interaction; the engine
 * never touches React state, React never repaints the engine's text. That
 * split keeps the react-compiler rules clean (no ref reads in render, no
 * sync setState in effects) while reusing the study's actual code.
 *
 * Data: props relayed from the ONE seam — /api/chain/tip?full=1 (our node
 * first, mempool next, pluggable server-side; owner ruling 0018.04.22).
 * This component performs no fetches of its own.
 */

export type { LivingTip };

export default function LivingClock(props: LivingTip) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<LivingClockEngine | null>(null);
  const [flipped, setFlipped] = useState(false);

  /* the engine — created once against the rendered DOM, destroyed on unmount */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const engine = createLivingClock(root);
    engineRef.current = engine;
    return () => {
      engineRef.current = null;
      engine.destroy();
    };
  }, []);

  /* the seam in — every new reading flows to the engine (block breaks,
     corrections, fills and the honest ~ are all detected in there) */
  const { height, estimated, fill, memCount, tipTimestamp, diffChange, diffRemaining } = props;
  useEffect(() => {
    engineRef.current?.update({
      height,
      estimated,
      fill,
      memCount,
      tipTimestamp,
      diffChange,
      diffRemaining,
    });
  }, [height, estimated, fill, memCount, tipTimestamp, diffChange, diffRemaining]);

  const toggle = () => setFlipped((f) => !f);

  return (
    <div className="lclk" ref={rootRef}>
      {/* a div, not a <section> — the site's global `section` rule adds page
          padding + a dashed border, which must never touch the card chrome */}
      <div
        className={`lclk-card${flipped ? " flipped" : ""}`}
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label="BFT flip clock — activate to flip it to the Day-0 countdown (block 983,664, 0018.10.28 a₿ — the new moon that starts the new calendar, ~7 Jan 2027 on the old calendar, around the day bitcoin turns 18)"
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <div className="flip3d">
          {/* ═══ FRONT — the BFT clock: ring, Pac, fiat ghosts, flip digits ═══ */}
          <div className="face face-front" aria-hidden={flipped}>
            <svg className="perimeter ringframe" aria-hidden="true">
              <path className="track" d="" />
              <line className="seam" />
              <g className="ringfx">
                <g className="pixlayer" />
                <g className="ghostlayer" />
                <g className="rewardcoin">
                  <g className="coin-inner">
                    <circle className="coin-back" r={12} />
                    {/* the real bitcoin.gif reward coin — the ONE place gold is allowed */}
                    <image
                      className="coin-img"
                      x={-13}
                      y={-13}
                      width={26}
                      height={26}
                      href="/bitcoin.gif"
                      preserveAspectRatio="xMidYMid meet"
                    />
                  </g>
                  {/* static gold ₿ fallback — shown only under reduced motion */}
                  <circle className="coin-static" r={11.5} />
                  <text className="coin-static-b" style={{ fontSize: 12 }}>
                    ₿
                  </text>
                </g>
                {/* the real 8-bit tricolor Pac's Arcade sprite — the chomp is a clip wedge */}
                <g className="pacman">
                  <image className="pac-sprite" href="/art/time/pac-tricolor.png" preserveAspectRatio="xMidYMid meet" />
                </g>
              </g>
            </svg>

            {/* FACE SIMPLIFICATION (owner ruling 0018.04.22): TIME big + date
                small only — the block height lives in the dateline's TOOLTIP
                (and in the experiment strip below), never as face chrome */}
            <div className="flipclock bftclock" role="timer" aria-label="Bitcoin Federated Time">
              {/* hour tens · hour ones — chain-exact, calm */}
              <div className="flip">
                <span className="flip-val">–</span>
              </div>
              <div className="flip">
                <span className="flip-val">–</span>
              </div>
              <span className="flip-colon">:</span>
              {/* minute tens — chain-exact, calm */}
              <div className="flip">
                <span className="flip-val">–</span>
              </div>
              {/* minute ones — LIVE: THE STRUGGLING DIGIT (block fullness in tenths) */}
              <div className="flip live">
                <span className="flip-val">–</span>
                <span className="flip-est">~</span>
              </div>
            </div>

            <div className="dateline">
              <span className="nb">
                <span className="bftdate">————.——.——</span> <span className="ab">a₿</span>
              </span>
            </div>
            <div
              className="oldcal"
              title="The same moment on the calendar you were handed — side by side, so you can watch the two drift apart."
            />
            <div className="blockpct" />
            <div
              className="levelbadge"
              title="Your arcade LEVEL. The network re-tunes its difficulty every ~2 weeks to keep blocks about 10 minutes apart. ▲ = getting harder · ▼ = getting easier."
            >
              LEVEL —
            </div>
            {/* "HACK THE PLANET" — the block-break easter egg (one fade, WCAG-safe) */}
            <div className="bang">HACK THE PLANET</div>

            <div className="oneliner">
              <b className="nb">PAC EATS THE WAITING PAYMENTS</b> <span className="nb">TEN LAPS = A NEW BLOCK, ~10 MIN</span>{" "}
              <span className="nb">FRUIT EVERY LAP · ₿ ON THE TENTH</span>
            </div>

            <div className="status">
              <span className="src">SYNCING</span>
              <span className="dot">·</span>
              <span className="memline">payments —</span>
              <span className="note" />
            </div>
            <div className="flip-hint">↻ FLIP</div>
          </div>

          {/* ═══ BACK — THE DAY-0 COUNTDOWN, the same split-flap running backwards ═══ */}
          <div className="face face-back" aria-hidden={!flipped}>
            <div className="flip-hint">↻ FLIP BACK</div>
            <div className="d0-timer">
              <div className="d0-head">
                <div className="d0-kick">THE COUNTDOWN</div>
                <div className="d0-title">DAY 0 — THE NEW MOON</div>
              </div>
              <div className="d0-target">
                BLOCK <span className="d0-block">983,664</span> · <span className="nb">0018.10.28&nbsp;a₿</span>
              </div>
              <div className="d0-oldcal">OLD CAL · ~7 JAN 2027</div>
              <div className="flipclock countdown" role="timer" aria-label="Countdown to Day 0 — the new moon, block 983,664">
                <div className="cd-unit">
                  <div className="cd-digits">
                    <div className="flip">
                      <span className="flip-val cd-d0">–</span>
                    </div>
                    <div className="flip">
                      <span className="flip-val cd-d1">–</span>
                    </div>
                    <div className="flip">
                      <span className="flip-val cd-d2">–</span>
                    </div>
                  </div>
                  <div className="cd-ul">Days</div>
                </div>
                <span className="flip-colon">:</span>
                <div className="cd-unit">
                  <div className="cd-digits">
                    <div className="flip">
                      <span className="flip-val cd-h0">–</span>
                    </div>
                    <div className="flip">
                      <span className="flip-val cd-h1">–</span>
                    </div>
                  </div>
                  <div className="cd-ul">Hrs</div>
                </div>
                <span className="flip-colon">:</span>
                <div className="cd-unit">
                  <div className="cd-digits">
                    <div className="flip">
                      <span className="flip-val cd-m0">–</span>
                    </div>
                    <div className="flip">
                      <span className="flip-val cd-m1">–</span>
                    </div>
                  </div>
                  <div className="cd-ul">Min</div>
                </div>
                <span className="flip-colon">:</span>
                <div className="cd-unit">
                  <div className="cd-digits">
                    <div className="flip">
                      <span className="flip-val cd-s0">–</span>
                    </div>
                    <div className="flip">
                      <span className="flip-val cd-s1">–</span>
                    </div>
                  </div>
                  <div className="cd-ul">Sec</div>
                </div>
              </div>
              <div className="d0-blocks">
                <b className="d0-togo">—</b> blocks to go
              </div>
              <div className="d0-note">
                the new moon that starts the new calendar — around the day bitcoin turns 18. the block is the
                truth; an ~estimate at ten minutes a block, counting DOWN to bitcoin-midnight.
              </div>
              <div className="d0-cheer">
                <div className="d0-cheer-emoji">🎈🎈🎈🎈🎈</div>
                <div className="d0-cheer-big">
                  THANK YOU,
                  <br />
                  SATOSHI
                </div>
                <div className="d0-cheer-sub">DAY 0 · THE NEW CALENDAR BEGINS</div>
              </div>
            </div>
            <div className="balloons" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}
