"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CONSOLE_NODE } from "@/lib/console";

/**
 * The HUD — the v2 prototype's built-in points area, made a shell fixture:
 * a compact always-visible readout on every deck (not just the rank panel):
 *
 *   NODE · RANK · PTS · CMDS
 *
 * One gated read of /api/admin/rank feeds it (the same door the rank track
 * panel reads — registry claim → BFT tenure → the fleet ladder; points and
 * commendations straight off the duty roster's resolved tickets). Semantics
 * hold: the rank seg is pink (honor-only, never coin), live counts are neon,
 * the node dot is neon (live). When the board doesn't answer, the HUD goes
 * honestly dark — "NO READ" beats an invented number, always.
 *
 * The rank seg is also the door to the full rank track (it absorbed the old
 * top-bar rank chip, so rank reads once, in one place).
 */

interface HudRead {
  tag: string | null;
  office: string | null;
  rank: { name: string; abbrev: string } | null;
  points: number;
  commendations: { n: number }[];
}

type HudState = { at: "reading" } | { at: "dark" } | { at: "lit"; read: HudRead };

export default function ScarHud() {
  const [hud, setHud] = useState<HudState>({ at: "reading" });

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/rank")
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return;
        setHud(data?.ok ? { at: "lit", read: data as HudRead } : { at: "dark" });
      })
      .catch(() => {
        if (alive) setHud({ at: "dark" });
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div
      className="scar-hud"
      aria-label="operator HUD — ship node, rank, points, commendations"
    >
      <span
        className="scar-hud__seg scar-hud__seg--node"
        title="this console's ship node — the name is config, not code"
      >
        <span className="scar-clockdot" aria-hidden="true" />
        {CONSOLE_NODE.name}
      </span>

      {hud.at === "reading" && (
        <span className="scar-hud__seg scar-hud__seg--dim">BOARD ▸ READING…</span>
      )}

      {hud.at === "dark" && (
        /* honest empty state — the board didn't answer, so the HUD stays dark */
        <span
          className="scar-hud__seg scar-hud__seg--dim"
          title="the rank board didn't answer — the HUD goes dark rather than invent numbers"
        >
          BOARD ▸ NO READ
        </span>
      )}

      {hud.at === "lit" && (
        <>
          <Link
            href="/a/testing#rank"
            className="scar-hud__seg scar-hud__seg--rank"
            title="your rank track — office label first (Pac's ruling); the full board lives on the crew board"
          >
            ▸ {hud.read.office ?? hud.read.rank?.name ?? "NO TAG YET"}
          </Link>
          <span
            className="scar-hud__seg"
            title="points — resolutions you logged on the duty roster (the board's own count)"
          >
            PTS <b>{hud.read.points}</b>
          </span>
          <span
            className="scar-hud__seg"
            title="commendations logged on the crew board — straight off resolved tickets"
          >
            CMDS <b>{hud.read.commendations.reduce((sum, c) => sum + c.n, 0)}</b>
          </span>
        </>
      )}
    </div>
  );
}
