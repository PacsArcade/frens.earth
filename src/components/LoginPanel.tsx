"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SigningExplainer from "@/components/SigningExplainer";
import SignerNudge from "@/components/SignerNudge";
import useFrenSession, { applyFrenSession } from "@/hooks/useFrenSession";
import { useBrand, type DoorAccent } from "@/lib/brand";

/* one-shot environment read, hydration-safe and lint-clean */
const noopSubscribe = () => () => {};
function useHasSigner(): boolean | null {
  return useSyncExternalStore(noopSubscribe, () => !!window.nostr, () => null);
}

/* Static per-accent class map — Tailwind v4 only generates classes it can see
   as complete literals, so door tints are looked up, never interpolated. */
const DOOR_ACCENT: Record<DoorAccent, { border: string; label: string; cta: string }> = {
  cyan: { border: "border-cyan/40", label: "text-cyan", cta: "text-cyan hover:glow-cyan" },
  pink: { border: "border-pink/40", label: "text-pink", cta: "text-cyan hover:glow-cyan" },
  coin: { border: "border-coin/40", label: "text-coin", cta: "text-cyan hover:glow-cyan" },
  neon: { border: "border-neon/40", label: "text-neon", cta: "text-cyan hover:glow-cyan" },
};

/**
 * The arcade's front door for returning frens: sign a fresh challenge with
 * your key, land on your profile. Below it, the two doors for new players —
 * play (@frens) and school (@pacsarcade) — with the difference explained
 * instead of assumed.
 */
export default function LoginPanel() {
  const router = useRouter();
  const hasSigner = useHasSigner();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { fren: existing, signOut } = useFrenSession();
  const { copy, doors } = useBrand();

  async function signIn() {
    setError(null);
    if (!window.nostr) {
      setError("no signer extension found — see the gear-up note below");
      return;
    }
    setBusy(true);
    try {
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
      const data = await res.json();
      if (!data.ok) {
        setError(data.reason);
        return;
      }
      /* flip the whole header without a hard nav — one store, no stale chip */
      applyFrenSession({ handle: data.handle, space: data.space, npub: data.npub ?? null });
      /* space-qualified so the right door opens on ANY host — the
         pacster@pacsarcade GAME OVER lesson */
      router.push(`/u/${data.handle}@${data.space}`);
    } catch {
      setError("signing was declined — nothing sent");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      {existing ? (
        <div className="mx-auto w-full max-w-md border-2 border-neon/60 bg-panel p-6 text-center">
          <p className="mb-3 font-pixel text-xs text-neon glow-neon">
            ✓ YOU&apos;RE IN AS {existing.handle.toUpperCase()}@{existing.space.toUpperCase()}
          </p>
          <Link
            href={`/u/${existing.handle}@${existing.space}`}
            className="button block w-full text-center"
          >
            ▶ GO TO MY PROFILE
          </Link>
          <button
            onClick={signOut}
            className="mt-3 font-pixel text-[9px] uppercase text-white/50 underline hover:text-ghost"
          >
            SIGN OUT
          </button>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-md border-4 border-cyan bg-panel p-6 shadow-[8px_8px_0_var(--color-pink)]">
          <p className="mb-2 font-pixel text-xs text-cyan glow-cyan">{copy.returningTitle}</p>
          <p className="mb-5 font-body text-sm text-white/70">{copy.returningBlurb}</p>
          {hasSigner === false ? (
            <SignerNudge />
          ) : (
            <button
              onClick={signIn}
              disabled={busy}
              className="button block w-full text-center disabled:opacity-50"
            >
              {busy ? copy.signingCta : copy.signInCta}
            </button>
          )}
          {error && <p className="mt-3 font-pixel text-[9px] uppercase text-ghost">{error}</p>}
          <div className="mt-4">
            <SigningExplainer kind="login" />
          </div>
        </div>
      )}

      <div className="space-y-4">
        <p className="text-center font-pixel text-[10px] uppercase tracking-widest text-white/40">
          {copy.doorsHeading}
        </p>
        {/* the doors stand side by side — pick like a character select */}
        <div
          className={`grid gap-4 sm:auto-rows-fr ${doors.length > 1 ? "sm:grid-cols-2" : ""}`}
        >
          {doors.map((door) => {
            const tint = DOOR_ACCENT[door.accent];
            return (
              <div key={door.tag} className={`border-2 bg-panel p-5 ${tint.border}`}>
                <p className={`mb-1 font-pixel text-[10px] ${tint.label}`}>
                  {door.tag} · {door.role}
                </p>
                <p className="mb-3 font-body text-sm text-white/70">{door.blurb}</p>
                {door.href.startsWith("http") ? (
                  <a href={door.href} className={`font-pixel text-[10px] uppercase underline ${tint.cta}`}>
                    {door.cta}
                  </a>
                ) : (
                  <Link href={door.href} className={`font-pixel text-[10px] uppercase underline ${tint.cta}`}>
                    {door.cta}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-center font-body text-xs text-white/50">{copy.doorsFootnote}</p>
      </div>
    </div>
  );
}
