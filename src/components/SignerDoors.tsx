"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { VerifiedEvent } from "nostr-tools/pure";
import {
  isAndroid,
  nip55SignUri,
  signViaBunker,
  startNostrConnect,
  type ChallengeKind,
} from "@/lib/signer-doors";

/**
 * The phone doors (spec: Module 6 / S1.5) — NIP-46 (remote signer, iOS +
 * any browser) and NIP-55 (Android signer apps) beside the NIP-07
 * extension. Same challenge, same endpoint, same session: the parent hands
 * us its submit function and keeps its own success navigation. Copy stays
 * honest about what each door needs; where a door can't work we say so —
 * never a fake door.
 */

/* hydration-safe one-shot platform read (the useHasSigner pattern) */
const noopSubscribe = () => () => {};
function useIsAndroid(): boolean | null {
  return useSyncExternalStore(noopSubscribe, () => isAndroid(), () => null);
}

export default function SignerDoors({
  kind,
  submit,
  next,
}: {
  kind: ChallengeKind;
  /** POST the signed challenge; resolve an error message, or null = the
      parent took over (session set, navigation underway). */
  submit: (event: VerifiedEvent) => Promise<string | null>;
  /** Same-origin path the NIP-55 bounce should land back on. */
  next?: string;
}) {
  const android = useIsAndroid();
  const [bunkerInput, setBunkerInput] = useState("");
  const [busy, setBusy] = useState<"idle" | "bunker" | "invite">("idle");
  const [invite, setInvite] = useState<{ uri: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  /* a half-open invite dies with the component */
  useEffect(() => {
    return () => {
      cancelRef.current?.();
    };
  }, []);

  /* nsec.app-style bunkers sometimes want a confirm page first */
  function onAuth(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleSigned(event: VerifiedEvent) {
    const reason = await submit(event);
    if (reason) setError(reason);
  }

  async function signBunker() {
    if (!bunkerInput.trim()) {
      setError("paste your bunker:// address (or name@domain) first");
      return;
    }
    setError(null);
    setBusy("bunker");
    try {
      await handleSigned(await signViaBunker(bunkerInput, kind, onAuth));
    } catch (e) {
      setError(e instanceof Error ? e.message : "the bunker didn't answer");
    } finally {
      setBusy("idle");
    }
  }

  function makeInvite() {
    setError(null);
    setCopied(false);
    cancelRef.current?.();
    const inv = startNostrConnect(kind, onAuth);
    cancelRef.current = inv.cancel;
    setInvite({ uri: inv.uri });
    setBusy("invite");
    inv.signed
      .then((event) => handleSigned(event))
      .catch((e) => {
        /* a cancel is the fren's call — only report real failures */
        if (!(e instanceof Error && /abort/i.test(e.message))) {
          setError(e instanceof Error ? e.message : "your signer never answered");
        }
      })
      .finally(() => {
        setBusy("idle");
        setInvite(null);
      });
  }

  function cancelInvite() {
    cancelRef.current?.();
    cancelRef.current = null;
    setInvite(null);
    setBusy("idle");
  }

  async function copyInvite() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.uri);
      setCopied(true);
    } catch {
      setError("couldn't reach the clipboard — long-press the link instead");
    }
  }

  function openSignerApp() {
    setError(null);
    /* challenge minted at tap time — the 5-minute window covers the bounce;
       the console door lands back on the room it was opened from */
    const ret = next ?? (kind === "console" ? window.location.pathname : undefined);
    window.location.href = nip55SignUri(kind, ret);
  }

  return (
    <div className="space-y-3">
      {/* ── NIP-46: remote signer / bunker — iOS + any browser ─────────── */}
      <details className="border-2 border-cyan/40 bg-void px-4 py-3">
        <summary className="cursor-pointer font-pixel text-[9px] uppercase text-cyan">
          REMOTE SIGNER · WORKS ON iPHONE + ANY BROWSER ▸
        </summary>
        <div className="mt-3 space-y-3">
          <p className="font-body text-xs leading-relaxed text-white/70">
            Your key lives in a signer you already trust — nsec.app, Amber, or
            your own nsecBunker — and answers over nostr. This page never sees
            it. Needs one of those set up first.
          </p>
          <label className="block font-pixel text-[9px] uppercase text-white/50">
            PASTE YOUR BUNKER ADDRESS
            <input
              value={bunkerInput}
              onChange={(e) => setBunkerInput(e.target.value)}
              placeholder="bunker://… or name@domain"
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full border-2 border-edge bg-panel px-3 py-2 font-mono text-base text-white sm:text-sm"
            />
          </label>
          <button
            onClick={signBunker}
            disabled={busy !== "idle"}
            className="button block min-h-11 w-full touch-manipulation text-center disabled:opacity-50"
          >
            {busy === "bunker" ? "ASKING YOUR SIGNER…" : "▶ CONNECT & SIGN"}
          </button>
          <div className="border-t-2 border-edge pt-3">
            <p className="mb-2 font-body text-xs text-white/50">
              No bunker address handy? Mint an invite — tap it on this phone,
              or paste it into a signer that speaks nostr connect.
            </p>
            {invite ? (
              <div className="space-y-2">
                <a
                  href={invite.uri}
                  className="block break-all border-2 border-cyan/40 bg-panel p-2 font-mono text-[10px] text-cyan underline"
                >
                  {invite.uri}
                </a>
                <p className="font-pixel text-[9px] uppercase text-cyan">
                  WAITING FOR YOUR SIGNER TO ANSWER…
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={copyInvite}
                    className="button min-h-11 flex-1 touch-manipulation text-center"
                  >
                    {copied ? "COPIED ✓" : "COPY INVITE"}
                  </button>
                  <button
                    onClick={cancelInvite}
                    className="min-h-11 flex-1 touch-manipulation border-2 border-edge font-pixel text-[9px] uppercase text-white/50"
                  >
                    NEVER MIND
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={makeInvite}
                disabled={busy !== "idle"}
                className="button block min-h-11 w-full touch-manipulation text-center disabled:opacity-50"
              >
                ▶ MINT A CONNECT INVITE
              </button>
            )}
          </div>
        </div>
      </details>

      {/* ── NIP-55: Android signer apps — honest about where it works ──── */}
      <details className="border-2 border-cyan/40 bg-void px-4 py-3">
        <summary className="cursor-pointer font-pixel text-[9px] uppercase text-cyan">
          ANDROID SIGNER APP · AMBER-CLASS ▸
        </summary>
        <div className="mt-3 space-y-3">
          {android === false ? (
            <p className="font-body text-xs leading-relaxed text-white/70">
              This door is Android-only — the <span className="font-mono">nostrsigner:</span>{" "}
              hand-off is an Android intent, and iPhone browsers have no
              equivalent. On this device, the remote-signer door above is the
              real one.
            </p>
          ) : (
            <>
              <p className="font-body text-xs leading-relaxed text-white/70">
                Your key lives in a signer app like{" "}
                <a
                  href="https://github.com/greenart7c3/Amber"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan underline"
                >
                  Amber
                </a>
                . Tap below and you&apos;ll bounce to it, read and approve the
                challenge, and bounce straight back signed in.
              </p>
              <button
                onClick={openSignerApp}
                className="button block min-h-11 w-full touch-manipulation text-center"
              >
                ▶ OPEN MY SIGNER APP
              </button>
              <p className="font-body text-xs text-white/50">
                Nothing opened? Then no signer app answered — this browser
                can&apos;t check ahead of time. Install Amber first, or use
                the remote-signer door above.
              </p>
            </>
          )}
        </div>
      </details>

      {error && <p className="font-pixel text-[9px] uppercase text-ghost">{error}</p>}
    </div>
  );
}
