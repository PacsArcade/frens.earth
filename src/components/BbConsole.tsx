"use client";

import { useCallback, useEffect, useState } from "react";
import { nip19 } from "nostr-tools";
import { PixelAvatar } from "@pacsarcade/arcade-ui";
import useFrenSession from "@/hooks/useFrenSession";
import type { StoredBuddy } from "@/lib/bb/types";
import { currentBlock } from "@/lib/bb/bft";
import { loadBuddies, upsertBuddy } from "@/lib/bb/store";
import Hatchery from "@/components/bb/Hatchery";
import BuddyDevice from "@/components/bb/BuddyDevice";

/**
 * The /bb front door + hatchery. Bitcoin Buddies work with ANY nostr key
 * (Pac, 2026-07-10): a fren session npub is used when present, otherwise a
 * one-tap NIP-07 connect (window.nostr) lets any key in. Non-tag-holders get a
 * "claim a @frens tag" upsell. Buddies persist per npub (localStorage v1), which
 * maps onto the BUDDY_DEFINITION/BUDDY_STATE nostr events when that wiring lands.
 */
export default function BbConsole() {
  const { fren, checked } = useFrenSession();
  const [clientNpub, setClientNpub] = useState<string | null>(null);
  const [block, setBlock] = useState<number | null>(null);
  const [buddies, setBuddies] = useState<StoredBuddy[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hatching, setHatching] = useState(false);
  const [connectErr, setConnectErr] = useState("");

  const npub = fren?.npub ?? clientNpub;

  useEffect(() => { currentBlock().then(setBlock); }, []);

  useEffect(() => {
    if (!npub) return;
    const list = loadBuddies(npub);
    setBuddies(list);
    setActiveId((id) => id ?? list[0]?.id ?? null);
    setHatching(list.length === 0);
  }, [npub]);

  const connect = useCallback(async () => {
    setConnectErr("");
    if (typeof window === "undefined" || !window.nostr?.getPublicKey) {
      setConnectErr("No nostr signer found — install a NIP-07 extension (e.g. Alby, nos2x) and reload.");
      return;
    }
    try {
      const pk = await window.nostr.getPublicKey();
      setClientNpub(nip19.npubEncode(pk));
    } catch {
      setConnectErr("Couldn't read your key — approve the signer prompt and try again.");
    }
  }, []);

  const handleHatched = useCallback((b: StoredBuddy) => {
    if (!npub) return;
    upsertBuddy(npub, b);
    setBuddies(loadBuddies(npub));
    setActiveId(b.id);
    setHatching(false);
  }, [npub]);

  const handleChange = useCallback((b: StoredBuddy) => {
    if (!npub) return;
    upsertBuddy(npub, b);
    setBuddies((prev) => prev.map((x) => (x.id === b.id ? b : x)));
  }, [npub]);

  if (!checked) {
    return (
      <p className="mx-auto max-w-md text-center font-pixel text-xs text-cyan pulse-neon">
        WAKING THE HATCHERY…
      </p>
    );
  }

  // ── no key yet → connect any nostr key (or claim a @frens tag) ──
  if (!npub) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 text-center">
        <p className="font-body text-sm text-white/70">
          Bitcoin Buddies are pixel pets born at a block and kept alive with your key.
          Connect any nostr key to hatch and care for one.
        </p>
        <button onClick={connect} className="button w-full sm:w-auto">▶ CONNECT YOUR KEY</button>
        {connectErr && <p className="font-mono text-xs text-ghost">{connectErr}</p>}
        <a href="https://pacsarcade.org/register" className="font-mono text-[11px] uppercase tracking-widest text-pink hover:underline">
          No key yet? Claim a @frens tag ▸
        </a>
      </div>
    );
  }

  if (block == null) {
    return (
      <p className="mx-auto max-w-md text-center font-pixel text-xs text-cyan pulse-neon">
        SYNCING TO THE BLOCK…
      </p>
    );
  }

  const active = buddies.find((b) => b.id === activeId) ?? buddies[0];
  const showHatchery = hatching || !active;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6">
      {/* who's holding the collar */}
      <section className="flex w-full max-w-md flex-wrap items-center gap-4 rounded-2xl border border-neon/40 bg-panel px-5 py-3">
        <PixelAvatar variant="player" seed={fren?.handle ?? npub} size={40} />
        <div className="min-w-0 flex-1">
          <p className="font-pixel text-[11px] text-neon glow-neon">
            {fren ? `✓ ${fren.handle.toUpperCase()}@${fren.space.toUpperCase()}` : "✓ KEY CONNECTED"}
          </p>
          <p className="mt-0.5 break-all font-mono text-[10px] text-cyan">{npub}</p>
        </div>
        {!fren && (
          <a href="https://pacsarcade.org/register" className="font-mono text-[10px] uppercase tracking-wider text-pink hover:underline">
            claim @frens ▸
          </a>
        )}
      </section>

      {/* roster switcher */}
      {buddies.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2">
          {buddies.map((b) => (
            <button key={b.id} onClick={() => { setActiveId(b.id); setHatching(false); }}
              className={`rounded-full border px-3 py-1 font-mono text-[11px] ${b.id === active?.id && !showHatchery ? "border-neon text-neon" : "border-edge text-white/50"}`}>
              {b.alive ? "" : "🪦 "}{b.name}
            </button>
          ))}
        </div>
      )}

      {active && !showHatchery ? (
        <BuddyDevice buddy={active} currentBlock={block} onChange={handleChange} onNew={() => setHatching(true)} />
      ) : (
        <Hatchery npub={npub} currentBlock={block} onHatched={handleHatched} />
      )}
    </div>
  );
}
