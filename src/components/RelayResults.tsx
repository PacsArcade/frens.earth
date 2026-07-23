"use client";

import { anyAccepted, relayLabel, type RelayResult } from "@/lib/kind0-publish";

/** The per-relay publish scoreboard — the honest answer to "did it save?".
    One accept = carried (the network gossips it onward); zero = say so. */
export default function RelayResults({ results }: { results: RelayResult[] }) {
  const carried = anyAccepted(results);
  return (
    <div className="border-2 border-edge bg-void px-3 py-2">
      <p
        className={`mb-1 font-pixel text-[9px] uppercase ${carried ? "text-neon glow-neon" : "text-ghost glow-ghost"}`}
      >
        {carried
          ? "✓ CARD PUBLISHED — THE RELAYS GOSSIP IT OUT FROM HERE"
          : "✗ NO RELAY TOOK THE CARD — NOTHING SAVED"}
      </p>
      <ul className="space-y-0.5">
        {results.map((r) => (
          <li key={r.relay} className="font-mono text-[10px]">
            <span className={r.ok ? "text-neon" : "text-ghost"}>{r.ok ? "✓" : "✗"}</span>{" "}
            <span className="text-white/60">{relayLabel(r.relay)}</span>
            {!r.ok && r.note && <span className="text-white/35"> — {r.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
