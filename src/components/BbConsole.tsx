"use client";

import { useCallback, useEffect, useState } from "react";
import { nip19 } from "nostr-tools";
import { PixelAvatar } from "@pacsarcade/arcade-ui";
import useFrenSession, { applyFrenSession } from "@/hooks/useFrenSession";
import type { StoredBuddy } from "@/lib/bb/types";
import { currentBlock } from "@/lib/bb/bft";
import { loadBuddies, upsertBuddy } from "@/lib/bb/store";
import Hatchery from "@/components/bb/Hatchery";
import BuddyDevice from "@/components/bb/BuddyDevice";

/** Short npub for display + starship naming: "npub18…h6w6" (npub + 2 + … + last 4). */
export const shortNpub = (n: string) => (n.length > 15 ? `${n.slice(0, 7)}…${n.slice(-4)}` : n);

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

  /* Connect = site-wide when possible (Pac, 2026-07-11): read the key, and if
     it holds a tag on THIS board, complete the real login in the same gesture
     (one more signer approve) — the pa-fren session flips the whole site, not
     just the baby. A tagless key still plays: bb-local connect, claim upsell. */
  const connect = useCallback(async () => {
    setConnectErr("");
    if (typeof window === "undefined" || !window.nostr?.getPublicKey) {
      setConnectErr("No nostr signer found — install a NIP-07 extension (e.g. Alby, nos2x) and reload.");
      return;
    }
    let pk: string;
    try {
      pk = await window.nostr.getPublicKey();
    } catch {
      setConnectErr("Couldn't read your key — approve the signer prompt and try again.");
      return;
    }
    const connectedNpub = nip19.npubEncode(pk);
    setClientNpub(connectedNpub);

    try {
      const who = await fetch(`/api/frens/whois?npub=${connectedNpub}`).then((r) => r.json());
      if (!who.ok || !who.holds?.length || !window.nostr.signEvent) return; // tagless — play local
      const event = await window.nostr.signEvent({
        kind: 22242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: `PACS-LOGIN-${Date.now()}`,
      });
      const res = await fetch("/api/frens/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        applyFrenSession({ handle: data.handle, space: data.space, npub: data.npub ?? null });
      }
    } catch {
      /* login declined or hiccuped — the key still plays bb-local */
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
        <a href="/" className="font-mono text-[11px] uppercase tracking-widest text-pink hover:underline">
          Claim your @frens tag ▸
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

  /* Identity, tag-first: the npub is plumbing and only shows when the key
     holds NO tag on this board (Pac, 2026-07-11). */
  const identityLine = fren ? `${fren.handle.toUpperCase()}@${fren.space.toUpperCase()}` : "KEY CONNECTED";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6">
      {/* who's holding the collar — mobile: a slim inline strip */}
      <section className="flex w-full max-w-md flex-wrap items-center gap-3 rounded-2xl border border-neon/40 bg-panel px-4 py-2 lg:hidden">
        <PixelAvatar variant="player" seed={fren?.handle ?? npub} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-pixel text-[10px] text-neon glow-neon">✓ {identityLine}</p>
          {!fren && <p className="mt-0.5 font-mono text-[10px] text-cyan">{shortNpub(npub)}</p>}
        </div>
        {!fren && (
          <a href="/" className="font-mono text-[10px] uppercase tracking-wider text-pink hover:underline">
            Claim a tag ▸
          </a>
        )}
      </section>

      {/* desktop: the mini rail — minimal on purpose; the buddy is the star */}
      <aside className="fixed right-4 top-32 z-40 hidden w-40 flex-col items-center gap-2 rounded-xl border border-edge/70 bg-panel/85 p-3 text-center backdrop-blur-sm lg:flex">
        <PixelAvatar variant="player" seed={fren?.handle ?? npub} size={36} />
        <p className="w-full truncate font-pixel text-[9px] text-neon">{identityLine}</p>
        {!fren && <p className="w-full truncate font-mono text-[9px] text-cyan">{shortNpub(npub)}</p>}
        {fren ? (
          <a
            href={`/u/${fren.handle}@${fren.space}`}
            className="font-pixel text-[8px] uppercase text-cyan hover:glow-cyan"
          >
            MY PROFILE ▸
          </a>
        ) : (
          <a href="/" className="font-pixel text-[8px] uppercase text-pink hover:underline">
            CLAIM A TAG ▸
          </a>
        )}
      </aside>

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
