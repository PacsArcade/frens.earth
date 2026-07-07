"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SigningExplainer from "@/components/SigningExplainer";
import SignerNudge from "@/components/SignerNudge";
import useFrenSession, { applyFrenSession } from "@/hooks/useFrenSession";

/* one-shot environment read, hydration-safe and lint-clean */
const noopSubscribe = () => () => {};
function useHasSigner(): boolean | null {
  return useSyncExternalStore(noopSubscribe, () => !!window.nostr, () => null);
}

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
    <div className="mx-auto flex max-w-md flex-col gap-8">
      {existing ? (
        <div className="border-2 border-neon/60 bg-panel p-6 text-center">
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
        <div className="border-4 border-cyan bg-panel p-6 shadow-[8px_8px_0_#ff00ff]">
          <p className="mb-2 font-pixel text-xs text-cyan glow-cyan">RETURNING FREN?</p>
          <p className="mb-5 font-body text-sm text-white/70">
            Your key is your login — sign a fresh challenge and land on your profile. No
            password, nothing stored, nothing to leak.
          </p>
          {hasSigner === false ? (
            <SignerNudge />
          ) : (
            <button
              onClick={signIn}
              disabled={busy}
              className="button block w-full text-center disabled:opacity-50"
            >
              {busy ? "WAITING FOR YOUR KEY…" : "▶ SIGN IN WITH MY KEY"}
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
          NO ACCOUNT? TWO DOORS, ONE ARCADE
        </p>
        <div className="border-2 border-cyan/40 bg-panel p-5">
          <p className="mb-1 font-pixel text-[10px] text-cyan">@FRENS · THE PLAY ACCOUNT</p>
          <p className="mb-3 font-body text-sm text-white/70">
            Free for everyone. Learn together, test, tinker, join classes, back campaigns —
            the account you can afford to experiment with. As frens, we learn together.
          </p>
          <Link
            href="/"
            className="font-pixel text-[10px] uppercase text-cyan underline hover:glow-cyan"
          >
            GET YOUR PLAY TAG — FREE ▸
          </Link>
        </div>
        <div className="border-2 border-pink/40 bg-panel p-5">
          <p className="mb-1 font-pixel text-[10px] text-pink">@PACSARCADE · THE SCHOOL ACCOUNT</p>
          <p className="mb-3 font-body text-sm text-white/70">
            The step up when you commit to the path: classes → etched certs → the artist gate →
            running campaigns. When you&apos;re ready for school, this is enrollment.
          </p>
          <a
            href="https://pacsarcade.org/register"
            className="font-pixel text-[10px] uppercase text-cyan underline hover:glow-cyan"
          >
            SET UP YOUR SCHOOL ACCOUNT ▸
          </a>
        </div>
        <p className="text-center font-body text-xs text-white/50">
          Two accounts is a feature, fren: experiment on one, keep the other clean — blast
          radius is self-custody&apos;s first habit.
        </p>
      </div>
    </div>
  );
}
