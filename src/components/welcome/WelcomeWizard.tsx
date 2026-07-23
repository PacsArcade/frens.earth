"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { nip19 } from "nostr-tools";
import type { Event as NostrEvent } from "nostr-tools";
import type { EventTemplate, VerifiedEvent } from "nostr-tools/pure";
import TagClaim from "@/components/TagClaim";
import Kind0Doors from "@/components/Kind0Doors";
import RelayResults from "@/components/RelayResults";
import ArtUpload from "@/components/ArtUpload";
import SigningExplainer from "@/components/SigningExplainer";
import useFrenSession from "@/hooks/useFrenSession";
import useNostrProfile from "@/hooks/useNostrProfile";
import { isAndroid } from "@/lib/signer-doors";
import { isImageUrl } from "@/components/ProfileEditor";
import { anyAccepted, publishKind0, type RelayResult } from "@/lib/kind0-publish";

/**
 * The welcome path — the nostr onboarding gauntlet, walked WITH the fren.
 * Doctrine: give them the choice, but give them an option — sovereign path
 * offered, working path default, honest states always. Every step is
 * skippable and the order is a suggestion, not a lock; skipping is never
 * punished.
 *
 * No keys are ever generated on this page — keys live in signers. The
 * guided mint for frens who need a key is nstart.me (new tab), or the
 * claim machine's own forge on the claim step.
 */

type StepKey = "signer" | "claim" | "face" | "wallet" | "done";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "signer", label: "1 · SIGNER" },
  { key: "claim", label: "2 · TAG" },
  { key: "face", label: "3 · FACE" },
  { key: "wallet", label: "4 · ZAPS" },
  { key: "done", label: "★ GO PLAY" },
];

/* hydration-safe one-shot platform read */
const noopSubscribe = () => () => {};
function usePlatform(): "android" | "ios" | "desktop" | null {
  return useSyncExternalStore(
    noopSubscribe,
    () =>
      isAndroid()
        ? "android"
        : /iphone|ipad|ipod/i.test(navigator.userAgent)
          ? "ios"
          : "desktop",
    () => null
  );
}
function useHasSignerInitial(): boolean | null {
  return useSyncExternalStore(noopSubscribe, () => !!window.nostr, () => null);
}

function StepChip({
  active,
  done,
  label,
  onClick,
}: {
  active: boolean;
  done: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer border-2 px-2 py-1.5 font-pixel text-[9px] uppercase ${
        active
          ? "border-cyan text-cyan glow-cyan"
          : done
            ? "border-neon/60 text-neon"
            : "border-edge text-white/40 hover:text-cyan"
      }`}
    >
      {done && !active ? "✓ " : ""}
      {label}
    </button>
  );
}

export default function WelcomeWizard({
  space,
  nip05Domain,
}: {
  space: string;
  nip05Domain: string;
}) {
  const platform = usePlatform();
  const signerInitial = useHasSignerInitial();
  const { fren, checked } = useFrenSession();

  const [step, setStep] = useState<StepKey>("signer");

  /* signer re-detect — "I have my signer now" presses this */
  const [signerRecheck, setSignerRecheck] = useState<boolean | null>(null);
  const [recheckedOnce, setRecheckedOnce] = useState(false);
  const signerPresent = signerRecheck ?? signerInitial;

  /* the key whose card the face/wallet steps edit: the session's npub, or
     one read from the NIP-07 signer on demand */
  const [connectedNpub, setConnectedNpub] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const npub = fren?.npub ?? connectedNpub;
  const { state: signal, profile, raw, applyLocal } = useNostrProfile(npub);

  /* face + wallet drafts — null = "not touched yet, show the live value" */
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [pictureDraft, setPictureDraft] = useState<string | null>(null);
  const [lud16Draft, setLud16Draft] = useState<string | null>(null);
  const [faceResults, setFaceResults] = useState<RelayResult[] | null>(null);
  const [walletResults, setWalletResults] = useState<RelayResult[] | null>(null);

  const liveName = typeof profile?.name === "string" ? profile.name : "";
  const livePicture = typeof profile?.picture === "string" ? profile.picture : "";
  const liveLud16 = typeof profile?.lud16 === "string" ? profile.lud16 : "";
  const nameValue = nameDraft ?? liveName;
  const pictureValue = pictureDraft ?? livePicture;
  const lud16Value = lud16Draft ?? liveLud16;

  async function connectNip07() {
    setConnectError(null);
    if (!window.nostr) {
      setConnectError("no signer extension answered — step 1 has the gear-up doors");
      return;
    }
    try {
      setConnectedNpub(nip19.npubEncode(await window.nostr.getPublicKey()));
    } catch {
      setConnectError("the signer declined — nothing read");
    }
  }

  /* one merge-and-sign builder for both mini steps */
  function prepareCard(edits: Record<string, string>): EventTemplate | { problem: string } {
    if (!npub) return { problem: "connect your signer or sign in first" };
    if (signal === "tuning") {
      return { problem: "still reading your current card from the relays — a moment" };
    }
    const content: Record<string, unknown> = { ...(raw?.content ?? {}) };
    for (const [k, v] of Object.entries(edits)) {
      const t = v.trim();
      if (t) content[k] = t;
      else delete content[k];
    }
    const created_at = Math.max(Math.floor(Date.now() / 1000), (raw?.created_at ?? 0) + 1);
    return { kind: 0, created_at, tags: raw?.tags ?? [], content: JSON.stringify(content) };
  }

  function makeSubmit(setResults: (r: RelayResult[]) => void) {
    return async (event: NostrEvent | VerifiedEvent): Promise<string | null> => {
      if (npub) {
        const decoded = nip19.decode(npub);
        if (decoded.type !== "npub" || event.pubkey !== decoded.data) {
          return "that signer holds a different key than the one this card belongs to — nothing sent";
        }
      }
      const results = await publishKind0(event as NostrEvent);
      setResults(results);
      if (!anyAccepted(results)) return "no relay accepted the card — nothing saved, try again";
      try {
        applyLocal(JSON.parse(event.content) as Record<string, unknown>, event.created_at);
      } catch {
        /* we built this content — unreachable, but never crash the flow */
      }
      return null;
    };
  }

  const stepDone: Record<StepKey, boolean> = {
    signer: signerPresent === true,
    claim: !!fren,
    face: signal === "found" && !!liveName,
    wallet: !!liveLud16,
    done: false,
  };

  const idx = STEPS.findIndex((s) => s.key === step);
  const next = () => setStep(STEPS[Math.min(idx + 1, STEPS.length - 1)].key);

  const skipRow = (
    <div className="mt-5 flex items-center justify-between border-t border-dashed border-edge pt-3">
      <p className="font-body text-xs text-white/40">skipping is fine — nothing here punishes you</p>
      <button
        type="button"
        onClick={next}
        className="cursor-pointer font-pixel text-[9px] uppercase text-white/50 underline hover:text-cyan"
      >
        SKIP ▸
      </button>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="text-center">
        <h1 className="font-arcade text-4xl text-coin glow-coin">WELCOME, FREN</h1>
        <p className="mx-auto mt-3 max-w-lg font-body text-sm text-white/70">
          The whole nostr walk-in — signer, tag, face, zaps — one step at a
          time, in any order you like. We walked it alone once; you don&apos;t
          have to.
        </p>
      </div>

      {/* the path — every chip is a door, not a lock */}
      <nav className="flex flex-wrap justify-center gap-2" aria-label="welcome steps">
        {STEPS.map((s) => (
          <StepChip
            key={s.key}
            active={step === s.key}
            done={stepDone[s.key]}
            label={s.label}
            onClick={() => setStep(s.key)}
          />
        ))}
      </nav>

      {/* ── STEP 1: SIGNER ─────────────────────────────────────────────── */}
      {step === "signer" && (
        <section className="border-2 border-edge bg-panel p-6">
          <p className="mb-1 font-pixel text-xs text-cyan glow-cyan">STEP 1 — YOUR SIGNER</p>
          <div className="mb-4 border-2 border-edge bg-void px-3 py-2">
            <p className="mb-1 font-pixel text-[10px] text-white/40">WHAT IS A KEY?</p>
            <p className="font-body text-xs leading-relaxed text-white/70">
              On nostr there are no accounts — there is one cryptographic key
              pair, and it IS you. The public half is your address; the secret
              half signs everything you do, and whoever holds it is you,
              forever, with no reset button. That&apos;s why the key never
              lives in a website (including this one): it lives in a{" "}
              <span className="text-cyan">signer</span> — a small app that
              holds the key and stamps signatures when you approve — and every
              site just asks the signer. A key is not a wallet, and signing
              can never move money.
            </p>
          </div>

          {signerPresent ? (
            <div className="border-2 border-neon/60 bg-neon/5 p-4">
              <p className="font-pixel text-xs text-neon glow-neon">
                ✓ SIGNER DETECTED — YOU&apos;RE READY
              </p>
              <p className="mt-2 font-body text-xs text-white/70">
                A signer extension answered in this browser. Every sign-and-approve
                on this ship goes through it — your key never leaves it.
              </p>
              <button type="button" onClick={next} className="button mt-4 block w-full text-center">
                ▶ NEXT — CLAIM YOUR TAG
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* per-platform guidance — the platform's own door first */}
              {(platform === "desktop" || platform === null) && (
                <div className="border-2 border-cyan/40 bg-void p-4">
                  <p className="mb-1 font-pixel text-[10px] uppercase text-cyan">
                    ON A DESKTOP · BROWSER EXTENSION
                  </p>
                  <p className="font-body text-xs text-white/70">
                    Install a signer extension, add your key, reload:{" "}
                    <a href="https://github.com/fiatjaf/nos2x" target="_blank" rel="noopener noreferrer" className="text-cyan underline">
                      nos2x
                    </a>{" "}
                    (just the signer, simplest) or{" "}
                    <a href="https://getalby.com" target="_blank" rel="noopener noreferrer" className="text-cyan underline">
                      Alby
                    </a>{" "}
                    (signer + wallet features later).
                  </p>
                </div>
              )}
              {(platform === "android" || platform === null) && (
                <div className="border-2 border-cyan/40 bg-void p-4">
                  <p className="mb-1 font-pixel text-[10px] uppercase text-cyan">
                    ON ANDROID · SIGNER APP
                  </p>
                  <p className="font-body text-xs text-white/70">
                    Install{" "}
                    <a href="https://github.com/greenart7c3/Amber" target="_blank" rel="noopener noreferrer" className="text-cyan underline">
                      Amber
                    </a>{" "}
                    — a signer app that holds your key on the phone; the browser
                    bounces to it for each approval and bounces back signed.
                  </p>
                </div>
              )}
              {(platform === "ios" || platform === null) && (
                <div className="border-2 border-cyan/40 bg-void p-4">
                  <p className="mb-1 font-pixel text-[10px] uppercase text-cyan">
                    ON iPHONE / ANYTHING ELSE · REMOTE SIGNER
                  </p>
                  <p className="font-body text-xs text-white/70">
                    Set up a remote signer like{" "}
                    <a href="https://nsec.app" target="_blank" rel="noopener noreferrer" className="text-cyan underline">
                      nsec.app
                    </a>{" "}
                    — your key lives there and answers over nostr itself; every
                    signing door on this ship takes a bunker address.
                  </p>
                </div>
              )}
              <div className="border-2 border-coin/40 bg-void p-4">
                <p className="mb-1 font-pixel text-[10px] uppercase text-coin">
                  NO KEY YET AT ALL?
                </p>
                <p className="font-body text-xs text-white/70">
                  Two honest options: the claim step (next) can forge one right
                  in your browser with the full ceremony — or{" "}
                  <a href="https://nstart.me" target="_blank" rel="noopener noreferrer" className="text-cyan underline">
                    nstart.me
                  </a>{" "}
                  is a guided key mint run by the nostr community (opens in a
                  new tab). Either way the key ends up in a signer, never in a
                  website.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRecheckedOnce(true);
                  setSignerRecheck(!!window.nostr);
                }}
                className="button block w-full text-center"
              >
                ▶ I HAVE MY SIGNER NOW — CHECK AGAIN
              </button>
              {recheckedOnce && signerRecheck === false && (
                <p className="font-pixel text-[9px] uppercase text-ghost">
                  STILL NO EXTENSION ANSWERING HERE — SIGNER APPS AND REMOTE SIGNERS
                  DON&apos;T SHOW UP IN THIS CHECK; IF YOURS IS ONE OF THOSE, JUST WALK ON
                </p>
              )}
            </div>
          )}
          {skipRow}
        </section>
      )}

      {/* ── STEP 2: CLAIM — the real claim machine, embedded ───────────── */}
      {step === "claim" && (
        <section>
          <div className="mb-4 border-2 border-edge bg-panel p-4 text-center">
            <p className="font-pixel text-xs text-cyan glow-cyan">STEP 2 — CLAIM YOUR TAG</p>
            <p className="mt-2 font-body text-xs text-white/60">
              name@{space} — verified on nostr the moment you claim, queued for
              the Bitcoin anchor batch. The same machine as the front page,
              nothing watered down.
            </p>
            {fren && (
              <p className="mt-2 font-pixel text-[9px] uppercase text-neon">
                ✓ ALREADY SIGNED IN AS {fren.handle.toUpperCase()}@{fren.space.toUpperCase()} —
                CLAIMING ANOTHER IS ALLOWED, SKIPPING IS FREE
              </p>
            )}
          </div>
          <TagClaim space={space} nip05Domain={nip05Domain} />
          <div className="mx-auto mt-4 max-w-2xl">{skipRow}</div>
        </section>
      )}

      {/* ── STEP 3: FACE — name + picture, sign & publish ──────────────── */}
      {step === "face" && (
        <section className="border-2 border-edge bg-panel p-6">
          <p className="mb-1 font-pixel text-xs text-cyan glow-cyan">STEP 3 — SHOW YOUR FACE</p>
          <p className="mb-4 font-body text-xs text-white/50">
            Your name and picture live in a small signed card (kind 0) that
            every nostr app reads. We read your current card first, change only
            these fields, and you sign the result — nothing else gets touched.
          </p>

          {!npub ? (
            <div className="space-y-3">
              <p className="font-body text-sm text-white/70">
                This step needs to know WHICH key&apos;s card to edit — so it can
                read your current one before rewriting anything.
              </p>
              <button type="button" onClick={connectNip07} className="button block w-full text-center">
                ▶ READ MY PUBLIC KEY FROM MY SIGNER
              </button>
              {connectError && (
                <p className="font-pixel text-[9px] uppercase text-ghost">{connectError}</p>
              )}
              <p className="font-body text-xs text-white/50">
                Using a remote signer or signer app instead?{" "}
                <Link href="/login" className="text-cyan underline">
                  sign in once
                </Link>{" "}
                (all three doors live there) and come back — or skip and dress
                up later at /me.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {signal === "tuning" && (
                <p className="font-pixel text-[9px] uppercase text-coin">
                  READING YOUR CURRENT CARD FROM THE RELAYS…
                </p>
              )}
              {signal === "silent" && (
                <p className="font-pixel text-[9px] uppercase text-white/50">
                  PROFILE NOT FOUND ON THE RELAYS YET — THIS WILL BE YOUR FIRST CARD
                </p>
              )}
              <div>
                <label htmlFor="ww-name" className="mb-1 block font-pixel text-[10px] text-white/40">
                  NAME — WHAT NOSTR APPS SHOW
                </label>
                <input
                  id="ww-name"
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder={fren ? fren.handle : "your name"}
                  className="w-full border-2 border-edge bg-void p-2 font-body text-sm text-white/85 placeholder:text-white/25 focus:border-cyan focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="ww-picture" className="mb-1 block font-pixel text-[10px] text-white/40">
                  PICTURE — UPLOAD OR PASTE A URL
                </label>
                <input
                  id="ww-picture"
                  type="text"
                  value={pictureValue}
                  onChange={(e) => setPictureDraft(e.target.value)}
                  placeholder="https:// image link"
                  className="w-full border-2 border-edge bg-void p-2 font-mono text-sm text-white/85 placeholder:text-white/25 focus:border-cyan focus:outline-none"
                />
                <div className="mt-1">
                  <ArtUpload label="UPLOAD AVATAR ART" onUrl={(url) => setPictureDraft(url)} />
                </div>
                {isImageUrl(pictureValue.trim()) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pictureValue.trim()}
                    alt=""
                    aria-hidden
                    className="mt-2 h-14 w-14 border-2 border-edge object-cover"
                  />
                )}
              </div>
              {faceResults && <RelayResults results={faceResults} />}
              <Kind0Doors
                prepare={() => {
                  if (!nameValue.trim() && !pictureValue.trim()) {
                    return { problem: "give yourself a name or a picture first — or skip" };
                  }
                  if (pictureValue.trim() && !isImageUrl(pictureValue.trim())) {
                    return { problem: "picture must be an https:// image link" };
                  }
                  return prepareCard({ name: nameValue, picture: pictureValue });
                }}
                submit={makeSubmit(setFaceResults)}
              />
              <SigningExplainer kind="profile" />
              {faceResults && anyAccepted(faceResults) && (
                <button type="button" onClick={next} className="button block w-full text-center">
                  ▶ NEXT — CATCH ZAPS
                </button>
              )}
            </div>
          )}
          {skipRow}
        </section>
      )}

      {/* ── STEP 4: WALLET (optional, never punished) ──────────────────── */}
      {step === "wallet" && (
        <section className="border-2 border-edge bg-panel p-6">
          <p className="mb-1 font-pixel text-xs text-cyan glow-cyan">
            STEP 4 — CATCH ZAPS <span className="text-white/40">(OPTIONAL)</span>
          </p>
          <p className="mb-4 font-body text-xs leading-relaxed text-white/60">
            A lightning address is how frens zap you — tiny bitcoin tips,
            straight to you. Any lightning address works (it looks like an
            email; it isn&apos;t one): a custodial wallet like Wallet of Satoshi
            or Alby gets you one in minutes, and you can swap it for a
            sovereign one any time. You can also just add one later at /me —
            nothing here expires.
          </p>

          {!npub ? (
            <p className="font-body text-sm text-white/70">
              Same as the face step — this edits your signed card, so it needs
              your key connected. Use step 3 to connect, or{" "}
              <Link href="/login" className="text-cyan underline">
                sign in
              </Link>{" "}
              and come back. Skipping is completely fine.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="ww-lud16" className="mb-1 block font-pixel text-[10px] text-white/40">
                  LIGHTNING ADDRESS (LUD16)
                </label>
                <input
                  id="ww-lud16"
                  type="text"
                  value={lud16Value}
                  onChange={(e) => setLud16Draft(e.target.value)}
                  placeholder="name@wallet-provider"
                  className="w-full border-2 border-edge bg-void p-2 font-mono text-sm text-white/85 placeholder:text-white/25 focus:border-cyan focus:outline-none"
                />
              </div>
              {walletResults && <RelayResults results={walletResults} />}
              <Kind0Doors
                prepare={() => {
                  const v = lud16Value.trim();
                  if (!v) return { problem: "paste a lightning address first — or skip, honestly" };
                  if (!/^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(v)) {
                    return { problem: "that doesn't look like name@domain" };
                  }
                  return prepareCard({ lud16: v });
                }}
                submit={makeSubmit(setWalletResults)}
              />
              {walletResults && anyAccepted(walletResults) && (
                <button type="button" onClick={next} className="button block w-full text-center">
                  ▶ NEXT — GO PLAY
                </button>
              )}
            </div>
          )}
          {skipRow}
        </section>
      )}

      {/* ── DONE — the doors of the ship ───────────────────────────────── */}
      {step === "done" && (
        <section className="border-4 border-neon bg-panel p-6 text-center shadow-[8px_8px_0_var(--color-pink)]">
          <p className="mb-3 font-pixel text-xs text-neon glow-neon">YOU MADE IT, FREN</p>
          {checked && fren ? (
            <p className="mb-2 break-all font-arcade text-[clamp(1.4rem,6vw,2rem)] leading-tight text-coin glow-coin">
              {fren.handle}@{fren.space}
            </p>
          ) : (
            <p className="mb-2 font-body text-sm text-white/60">
              No session on this browser yet — claim a tag and{" "}
              <Link href="/login" className="text-cyan underline">
                sign in
              </Link>{" "}
              whenever you&apos;re ready; the steps behind you stay done.
            </p>
          )}
          <p className="mb-5 font-body text-xs text-white/50">
            everything you set here is yours — key, tag, card. no account to lose.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link href="/me" className="button block text-center">
              MY TAG · /me
            </Link>
            <Link href="/store" className="button block text-center">
              THE STORE
            </Link>
            <Link href="/bb" className="button block text-center">
              THE BOARDS
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
