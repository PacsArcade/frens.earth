"use client";

import { useState } from "react";

/**
 * SEAT A RESERVED NAME — the captain's hand on the registry. Reserved names
 * never pass the public queue; this panel is the one door that seats them,
 * behind the operator gate, with one confirm step that restates exactly what
 * will happen before anything is sent. House laws: honest states (the button
 * you see is the action that runs), errors verbatim from the server, and
 * identity colours only — cyan/pink, never gold.
 */

interface SeatedEntry {
  handle: string;
  npub: string;
  status: string;
  requestedAt: string;
  blockHeight?: number | null;
}

type Phase = "form" | "confirm" | "seating" | "seated";

export default function SeatReservedPanel({ space }: { space: string }) {
  const [phase, setPhase] = useState<Phase>("form");
  const [handle, setHandle] = useState("");
  const [npub, setNpub] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<SeatedEntry | null>(null);

  const cleanHandle = handle.trim().toLowerCase();
  const cleanNpub = npub.trim();
  const ready = cleanHandle.length > 0 && cleanNpub.length > 0;

  async function seat() {
    setPhase("seating");
    setError(null);
    try {
      const res = await fetch("/api/admin/registry/seat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: cleanHandle, npub: cleanNpub, space }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.reason ?? `request failed (${res.status})`);
        setPhase("form");
        return;
      }
      setEntry(data.entry);
      setPhase("seated");
    } catch {
      setError("the request didn't reach the registry — check the connection and try again");
      setPhase("form");
    }
  }

  if (phase === "seated" && entry) {
    return (
      <div className="console-card max-w-xl p-5" data-accent="cyan">
        <p className="mb-3 font-pixel text-xs text-cyan glow-cyan">
          SEATED — THE NAME IS ON THE BOARD
        </p>
        <div className="space-y-1 font-mono text-xs text-white/80">
          <p>
            TAG: <span className="text-cyan">{entry.handle}</span>
            <span className="text-pink">@{space}</span>
          </p>
          <p className="break-all">
            KEY: <span className="text-white">{entry.npub}</span>
          </p>
          <p>STATUS: {entry.status.toUpperCase()}</p>
          <p>SEATED AT: {new Date(entry.requestedAt).toLocaleString()}</p>
          {typeof entry.blockHeight === "number" && <p>BLOCK: ▣ {entry.blockHeight.toLocaleString()}</p>}
        </div>
        <p className="mt-3 font-body text-xs text-white/50">
          The key signs in now and {entry.handle}@{space} verifies over NIP-05. The entry rides
          the next anchor batch with the public queue.
        </p>
        <button
          onClick={() => {
            setHandle("");
            setNpub("");
            setEntry(null);
            setPhase("form");
          }}
          data-accent="cyan"
          className="btn-pill btn-pill--muted mt-4"
        >
          SEAT ANOTHER
        </button>
      </div>
    );
  }

  if (phase === "confirm" || phase === "seating") {
    return (
      <div className="console-card max-w-xl p-5" data-accent="pink">
        <p className="mb-3 font-pixel text-xs text-pink">CONFIRM THE SEAT</p>
        <p className="font-body text-sm text-white/80">
          Seats <span className="font-mono text-cyan">{cleanHandle}</span>
          <span className="font-mono text-pink">@{space}</span> to
        </p>
        <p className="my-2 break-all font-mono text-xs text-white">{cleanNpub}</p>
        <p className="mb-5 font-pixel text-[9px] uppercase leading-relaxed text-white/50">
          RESERVED NAMES ONLY MOVE BY THE CAPTAIN&apos;S HAND
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={seat}
            disabled={phase === "seating"}
            data-accent="cyan"
            className="btn-pill btn-pill--solid"
          >
            {phase === "seating" ? "SEATING…" : "▶ SEAT IT"}
          </button>
          <button
            onClick={() => setPhase("form")}
            disabled={phase === "seating"}
            data-accent="cyan"
            className="btn-pill btn-pill--muted"
          >
            BACK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="console-card max-w-xl p-5" data-accent="cyan">
      <p className="mb-1 font-pixel text-xs text-cyan">SEAT A RESERVED NAME</p>
      <p className="mb-5 font-body text-sm text-white/70">
        Reserved names are protected from the public queue — they only enter the registry
        here, by your hand. The seated key signs in and serves NIP-05 immediately.
      </p>
      <label className="block">
        <span className="font-pixel text-[9px] uppercase text-white/40">HANDLE</span>
        <span className="mt-1 flex items-center gap-1">
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="pacster"
            className="w-full rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-cyan placeholder:text-white/25 focus:border-cyan focus:outline-none"
          />
          <span className="font-mono text-xs text-pink">@{space}</span>
        </span>
      </label>
      <label className="mt-4 block">
        <span className="font-pixel text-[9px] uppercase text-white/40">
          NOSTR PUBLIC KEY (NPUB)
        </span>
        <input
          value={npub}
          onChange={(e) => setNpub(e.target.value)}
          placeholder="npub1…"
          className="mt-1 w-full rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-white/80 placeholder:text-white/25 focus:border-cyan focus:outline-none"
        />
      </label>
      <button
        onClick={() => {
          setError(null);
          setPhase("confirm");
        }}
        disabled={!ready}
        data-accent="cyan"
        className="btn-pill btn-pill--solid mt-5 flex w-full"
      >
        SEAT THIS NAME ▸
      </button>
      {error && <p className="mt-3 font-pixel text-[9px] uppercase text-ghost">{error}</p>}
    </div>
  );
}
