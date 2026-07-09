"use client";

import { useEffect, useState } from "react";
import { rankFor, type PokeProfile } from "@/lib/poke";

/* MUD-style clock, friendlier: "34m", "1h 05m", "42s" — bench time reads
   like a break, not a sentence. */
function fmtLeft(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${s}s`;
}

/* Ticking deadline pinned at mount — when it hits zero the chip goes away
   on its own, because a chip past its timer would be a dishonest state. */
function useCountdown(leftS: number): number {
  const [deadline] = useState(() => Date.now() + leftS * 1000);
  const [left, setLeft] = useState(() => Math.max(0, leftS));
  useEffect(() => {
    if (leftS <= 0) return;
    const id = setInterval(
      () => setLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000))),
      1000
    );
    return () => clearInterval(id);
  }, [deadline, leftS]);
  return left;
}

/**
 * The fren's live game-floor scoreboard, straight from their POKE node's
 * public /u/ hook. Renders only when the node answered — a dark node means
 * the profile simply doesn't wear this card (no error splash).
 */
export default function PokeArcadeCard({
  poke,
  handle,
}: {
  poke: PokeProfile;
  handle: string;
}) {
  // The node's own rank title wins; the mirrored ladder only covers nodes
  // that predate the hook's rank field.
  const rank = poke.rank ?? rankFor(poke.verse, poke.level);
  const permanent = poke.moderation.ban_left_s === -1;
  const banLeft = useCountdown(
    poke.moderation.banned && !permanent ? poke.moderation.ban_left_s : 0
  );
  const timeoutLeft = useCountdown(poke.moderation.timeout_s);
  const benched = poke.moderation.banned && (permanent || banLeft > 0);

  return (
    <section className="border-b-0 py-0">
      <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
        HIGH SCORES FROM THE GAME FLOOR — {poke.world}
      </p>
      <h2 className="mb-4 font-arcade text-2xl text-coin glow-coin">ARCADE STATS</h2>
      <div className="border-2 border-edge bg-panel p-5">
        {/* status strip: presence first, then the honest asterisks */}
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="flex items-center gap-2 font-pixel text-[10px] uppercase">
            <span
              aria-hidden
              className={`h-2.5 w-2.5 flex-none rounded-full ${
                poke.online ? "bg-neon pulse-neon shadow-[0_0_8px_currentColor] text-neon" : "bg-white/25"
              }`}
            />
            <span className={poke.online ? "text-neon" : "text-white/40"}>
              {poke.online ? "ON THE FLOOR NOW" : "OFF THE FLOOR"}
            </span>
          </span>
          {poke.name.toLowerCase() !== handle.toLowerCase() && (
            <span className="font-pixel text-[10px] uppercase text-white/40">
              PLAYING AS <span className="text-cyan">{poke.name}</span>
            </span>
          )}
          {poke.demo_mode && (
            <span
              className="border-2 border-coin/60 bg-coin/5 px-2 py-1 font-pixel text-[10px] uppercase text-coin"
              title="Demo mode: the whole floor is practice — nothing etches to Bitcoin yet"
            >
              DEMO — PRACTICE RUNES
            </span>
          )}
        </div>

        {/* the scoreboard — three counters, arcade-cabinet style */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="border border-edge px-2 py-3">
            <p className="font-arcade text-2xl text-cyan glow-cyan">{poke.level}</p>
            <p className="mt-1 font-pixel text-[9px] uppercase text-white/40">
              LEVEL
              {rank && (
                <>
                  {" "}· <span className="text-cyan">{rank}</span>
                </>
              )}
            </p>
          </div>
          <div className="border border-edge px-2 py-3">
            <p className="font-arcade text-2xl text-coin glow-coin">
              {poke.xp.toLocaleString()}
            </p>
            <p className="mt-1 font-pixel text-[9px] uppercase text-white/40">XP</p>
          </div>
          <div className="border border-edge px-2 py-3">
            <p className="font-arcade text-2xl text-neon glow-neon">{poke.runes}</p>
            <p className="mt-1 font-pixel text-[9px] uppercase text-white/40">
              {poke.demo_mode ? "PRACTICE RUNES" : "RUNES"}
            </p>
          </div>
        </div>

        {/* the bench — consequences, not prohibitions; same wording family
            as the MUD's GAME OVER screen */}
        {benched && (
          <div className="mt-4 border-2 border-ghost/70 bg-ghost/5 p-4">
            <p className="font-pixel text-[10px] uppercase text-ghost glow-ghost">
              ⛔ BENCHED{permanent ? " — NO TIMER ON THIS ONE" : ` — BACK IN ${fmtLeft(banLeft)}`}
            </p>
            {poke.moderation.ban_reason && (
              <p className="mt-2 break-words font-body text-xs text-white/70">
                Reason: {poke.moderation.ban_reason}
              </p>
            )}
            <p className="mt-2 font-body text-xs text-white/70">
              {permanent
                ? "Benched from the arcade — this bench has no timer; talk to the operator. The high score will wait. 💜"
                : `Benched from the arcade — back in ${fmtLeft(banLeft)}. Hydrate. Take a stroll. The high score will wait. 💜`}
            </p>
          </div>
        )}
        {!benched && timeoutLeft > 0 && (
          <div className="mt-4 border-2 border-coin/60 bg-coin/5 p-4">
            <p className="font-pixel text-[10px] uppercase text-coin">
              ⧗ TIMEOUT — CHAT RE-OPENS IN {fmtLeft(timeoutLeft)}
            </p>
            <p className="mt-2 font-body text-xs text-white/70">
              Benched from chat, not the game — stretch, sip some water, the
              conversation will keep. 💜
            </p>
          </div>
        )}

        <p className="mt-4 font-body text-xs text-white/50">
          Live from the <span className="text-cyan">{poke.verse}</span> verse node —
          real game state, not our database. Mutes never show here: those are
          session business, gone at sign-out.
        </p>
      </div>
    </section>
  );
}
