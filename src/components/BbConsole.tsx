"use client";

import { PixelAvatar } from "@pacsarcade/arcade-ui";
import useFrenSession from "@/hooks/useFrenSession";
import LoginPanel from "@/components/LoginPanel";
import { buddiesForOwner } from "@/lib/bb/buddies";

/**
 * The /bb front door. Gates the Bitcoin Buddy module on the SAME nostr NIP-07
 * sign-in every other page uses — no new auth:
 *
 *   • session   → useFrenSession (the shared /api/frens/session store)
 *   • signed out → LoginPanel (the existing brand-themed sign-in component;
 *                  it signs a PACS-LOGIN challenge with window.nostr)
 *   • signed in  → the connected npub + a placeholder "Your Buddies" roster
 *
 * Note: LoginPanel routes a FRESH sign-in to the fren's profile (its built-in
 * behavior). A returning fren (month-long cookie) lands straight on the roster.
 */
export default function BbConsole() {
  const { fren, checked } = useFrenSession();

  // Don't flash a signed-out state before the session answers (FrenChip pattern).
  if (!checked) {
    return (
      <p className="mx-auto max-w-md text-center font-pixel text-xs text-cyan pulse-neon">
        WAKING THE HATCHERY…
      </p>
    );
  }

  if (!fren) {
    return (
      <div className="space-y-8">
        <p className="mx-auto max-w-2xl text-center font-body text-sm text-white/70">
          Bitcoin Buddies are co-owned by frens and cared for with signed nostr
          events. Sign in with your key to meet your buddies.
        </p>
        <LoginPanel />
      </div>
    );
  }

  const buddies = buddiesForOwner(fren.npub);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      {/* Who's holding the collar — the signed-in key. */}
      <section className="flex flex-wrap items-center gap-5 border-2 border-neon/50 bg-panel p-6">
        <PixelAvatar variant="player" seed={fren.handle} size={56} />
        <div className="min-w-0 flex-1">
          <p className="font-pixel text-xs text-neon glow-neon">
            ✓ SIGNED IN AS {fren.handle.toUpperCase()}@{fren.space.toUpperCase()}
          </p>
          {fren.npub ? (
            <p className="mt-1 break-all font-mono text-xs text-cyan">{fren.npub}</p>
          ) : (
            <p className="mt-1 font-body text-xs text-white/50">
              key connected — no registry npub on file yet
            </p>
          )}
          <p className="mt-2 font-body text-xs text-white/50">
            Care actions — feed · play · talk — are signed with this key. Any
            fren on a buddy&apos;s collar can help keep it alive.
          </p>
        </div>
      </section>

      {/* The roster — placeholder until the hatchery opens. */}
      <section>
        <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
          TICK TOCK — EVERYTHING GETS TIED TO THE BLOCK
        </p>
        <h2 className="mb-4 font-arcade text-2xl text-neon glow-neon">YOUR BUDDIES</h2>
        {buddies.length === 0 ? (
          <div className="border-2 border-edge bg-panel p-6">
            <p className="mb-2 font-pixel text-xs text-white/60">NO BUDDIES YET</p>
            <p className="font-body text-sm text-white/80">
              The hatchery isn&apos;t open yet, fren. Soon you&apos;ll hatch a
              Bitcoin Buddy — born at a block, co-owned with your frens, and kept
              alive with your key. 💜
            </p>
            <button
              disabled
              className="button mt-4 w-full text-center opacity-50 sm:w-auto"
              title="the hatchery opens soon"
            >
              HATCH A BUDDY ▸ (SOON)
            </button>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {buddies.map((b) => (
              <li key={b.id} className="border-2 border-edge bg-panel p-5">
                <p className="font-pixel text-xs text-cyan">{b.name}</p>
                <p className="mt-1 font-body text-xs text-white/50">
                  born block {b.bornBlock.toLocaleString()} · {b.owners.length} on the collar
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
