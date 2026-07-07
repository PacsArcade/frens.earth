"use client";

import { useState } from "react";
import type { HandleStatus } from "@/lib/registry";
import useFrenSession, { applyFrenSession } from "@/hooks/useFrenSession";

/**
 * FREE THE NAME — the right of exit, own profile only, and only while the
 * anchor is pending. Releasing puts the name back in the pool and removes
 * the verified nostr address; the fren's key and posts are untouched (we
 * never owned those). Once etched, names are permanent — this section
 * simply doesn't render for committed entries.
 */
export default function ReleaseTag({
  handle,
  space,
  status,
  nip05Domain,
}: {
  handle: string;
  space: string;
  status: HandleStatus;
  nip05Domain: string;
}) {
  const { fren } = useFrenSession();
  const [arming, setArming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freed, setFreed] = useState(false);

  /* farewell first — releasing clears the session, which would otherwise
     hide this section before the goodbye ever rendered */
  if (freed) {
    return (
      <section className="border-2 border-ghost/60 bg-panel p-6 text-center">
        <p className="font-pixel text-xs text-ghost glow-ghost">
          GAME OVER — {handle.toUpperCase()} IS BACK IN THE POOL. YOUR KEY IS STILL YOURS. 💜
        </p>
      </section>
    );
  }

  const own = fren && fren.handle === handle && fren.space === space;
  if (!own || status !== "queued") return null;

  async function release() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/frens/release", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.reason ?? "the registry didn't answer");
        return;
      }
      applyFrenSession(null);
      setFreed(true);
      /* back to the door — the profile page under this URL no longer exists */
      setTimeout(() => {
        window.location.href = "/";
      }, 2500);
    } catch {
      setError("the registry didn't answer — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-2 border-edge bg-panel p-6">
      <p className="mb-2 font-pixel text-xs text-white/40">CHANGED YOUR MIND, FREN?</p>
      {!arming ? (
        <div className="flex flex-wrap items-center gap-5">
          <p className="min-w-[16rem] flex-1 font-body text-sm text-white/60">
            While the anchor is pending, this name isn&apos;t carved yet — you can free it and
            the board forgets it ever happened.
          </p>
          <button
            type="button"
            onClick={() => setArming(true)}
            className="cursor-pointer border-2 border-ghost/60 px-4 py-2 font-pixel text-[10px] uppercase text-ghost hover:bg-ghost/10"
          >
            FREE THIS NAME
          </button>
        </div>
      ) : (
        <div className="border-2 border-ghost/60 bg-void p-4">
          <p className="mb-3 font-pixel text-[10px] uppercase text-ghost">
            ⚠ READ TWICE, PRESS ONCE
          </p>
          <div className="mb-4 space-y-2 font-body text-sm text-white/75">
            <p>
              Freeing{" "}
              <span className="font-mono text-cyan">
                {handle}@{space}
              </span>{" "}
              removes it from the registry and the queue: the verified address{" "}
              <span className="font-mono text-cyan">
                {handle}@{nip05Domain}
              </span>{" "}
              stops verifying, this profile page goes dark, and anyone — including a stranger —
              can claim the name next.
            </p>
            <p>
              What it does <span className="text-coin">not</span>{" "}touch: your key, and anything
              you&apos;ve posted with it. Those were never ours to take — that&apos;s the whole
              lesson.
            </p>
          </div>
          {error && <p className="mb-3 font-pixel text-[9px] uppercase text-ghost">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={release}
              disabled={busy}
              className="cursor-pointer border-2 border-ghost bg-ghost/10 px-4 py-2 font-pixel text-[10px] uppercase text-ghost disabled:opacity-50"
            >
              {busy ? "FREEING…" : "✕ YES — FREE THE NAME"}
            </button>
            <button
              type="button"
              onClick={() => setArming(false)}
              disabled={busy}
              className="cursor-pointer border-2 border-edge px-4 py-2 font-pixel text-[10px] uppercase text-white/50 hover:border-cyan hover:text-cyan"
            >
              KEEP MY TAG
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
