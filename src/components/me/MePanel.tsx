"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useFrenSession from "@/hooks/useFrenSession";
import useNostrProfile from "@/hooks/useNostrProfile";
import ProfileEditor from "@/components/ProfileEditor";
import { domainForSpace, SPACE_ROLES } from "@/lib/identity-config";

/* Mirrors MAX_SESSIONS in src/lib/fren-auth.ts — that module is server-only
   (node crypto), so the number is restated here rather than imported. */
const MAX_SESSIONS = 8;

/**
 * /me — the fren's own control room. Three panels, all honest:
 *
 * 1. WHO YOU ARE — the ACTIVE tag big (the tag is the name; the npub is
 *    plumbing, small and muted), plus every tag the active key holds across
 *    this ship's known spaces (whois).
 * 2. YOUR DOORS — the 8-session switcher made visible: every signed-in
 *    door, switch, add another, close one, close all.
 * 3. YOUR PROFILE CARD — the kind-0 editor (ProfileEditor), loading the
 *    live signal from the big relays and signing through the signer doors.
 */

/* Floor accent — same colors the header menu wears. */
function accentText(space: string): string {
  return space === "pacsarcade" ? "text-pink" : "text-cyan";
}

export default function MePanel() {
  const router = useRouter();
  const { fren, accounts, checked, signOut, signOutOne, switchTo } = useFrenSession();
  const { state: signal, raw, applyLocal } = useNostrProfile(fren?.npub);

  /* every tag the ACTIVE key holds, across known spaces — public whois data */
  const [holds, setHolds] = useState<{ handle: string; space: string }[] | null>(null);
  useEffect(() => {
    if (!fren?.npub) return;
    let alive = true;
    fetch(`/api/frens/whois?npub=${fren.npub}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.ok) setHolds(d.holds);
      })
      .catch(() => {
        /* the listing is a nicety — the page stands without it */
      });
    return () => {
      alive = false;
    };
  }, [fren?.npub]);

  const [confirmAllOut, setConfirmAllOut] = useState(false);

  if (!checked) {
    return (
      <p className="text-center font-pixel text-[10px] uppercase text-cyan glow-cyan">
        CHECKING YOUR SESSION…
      </p>
    );
  }

  if (!fren) {
    return (
      <div className="mx-auto w-full max-w-md border-2 border-cyan/40 bg-panel p-6 text-center">
        <p className="mb-3 font-pixel text-xs text-cyan glow-cyan">THIS ROOM NEEDS YOUR KEY</p>
        <p className="mb-5 font-body text-sm text-white/70">
          /me is your own control room — sessions, tags, profile card. Sign in
          with your key to open it.
        </p>
        <Link href="/login" className="button block w-full text-center">
          ▶ SIGN IN
        </Link>
        <p className="mt-4 font-body text-xs text-white/50">
          New here?{" "}
          <Link href="/welcome" className="text-cyan underline hover:glow-cyan">
            walk the welcome path
          </Link>{" "}
          — signer, tag, face, all in order.
        </p>
      </div>
    );
  }

  const others = accounts.filter((a) => !(a.handle === fren.handle && a.space === fren.space));
  const heldElsewhere = (holds ?? []).filter(
    (h) => !(h.handle === fren.handle && h.space === fren.space)
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      {/* ── WHO YOU ARE — the tag is the name ─────────────────────────── */}
      <section className="border-4 border-cyan bg-panel p-6 text-center shadow-[8px_8px_0_var(--color-pink)]">
        <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
          YOUR ACTIVE TAG
        </p>
        <p className="break-all font-arcade text-[clamp(1.6rem,7vw,2.5rem)] leading-tight text-coin glow-coin">
          {fren.handle}
          <span className={accentText(fren.space)}>@{fren.space}</span>
        </p>
        <p className="mt-1 font-pixel text-[9px] uppercase text-white/40">
          {(SPACE_ROLES[fren.space] ?? "verse").toUpperCase()} FLOOR ·{" "}
          <Link href={`/u/${fren.handle}@${fren.space}`} className="text-cyan underline">
            PUBLIC PROFILE PAGE
          </Link>
        </p>
        {fren.npub ? (
          <p className="mx-auto mt-4 max-w-md break-all font-mono text-[10px] leading-relaxed text-white/30">
            {fren.npub}
          </p>
        ) : (
          <p className="mt-4 font-pixel text-[9px] uppercase text-ghost">
            THE REGISTRY DOESN&apos;T KNOW THIS TAG&apos;S KEY — TELL THE OPERATOR
          </p>
        )}
        <p className="mt-1 font-body text-xs text-white/40">
          the long code is plumbing — the tag is the name
        </p>

        {/* every tag this key holds on the ship's known spaces */}
        {holds !== null && (
          <div className="mt-5 border-t border-dashed border-edge pt-4 text-left">
            <p className="mb-2 font-pixel text-[9px] uppercase text-white/40">
              TAGS THIS KEY HOLDS
            </p>
            {holds.length === 0 ? (
              <p className="font-body text-xs text-white/50">
                the registry lists no tags for this key — that shouldn&apos;t happen while
                you&apos;re signed in; tell the operator
              </p>
            ) : (
              <ul className="space-y-1">
                {holds.map((h) => {
                  const active = h.handle === fren.handle && h.space === fren.space;
                  return (
                    <li key={`${h.handle}@${h.space}`} className="flex items-center gap-2">
                      <span className="font-mono text-sm text-coin">
                        {h.handle}
                        <span className={accentText(h.space)}>@{h.space}</span>
                      </span>
                      {active ? (
                        <span className="font-pixel text-[9px] uppercase text-neon">◆ ACTIVE</span>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            /* same key already proved itself — the PUT lets
                               a sibling tag through without re-signing */
                            if (await switchTo(h.handle, h.space)) router.refresh();
                          }}
                          className="cursor-pointer font-pixel text-[9px] uppercase text-cyan underline hover:glow-cyan"
                        >
                          ⇄ MAKE ACTIVE
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {heldElsewhere.length > 0 && (
              <p className="mt-2 font-body text-xs text-white/40">
                same key, no re-signing — switching a sibling tag is one press
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── YOUR DOORS — the 8-session switcher, visible and friendly ──── */}
      <section className="border-2 border-edge bg-panel p-6">
        <p className="mb-1 font-pixel text-xs text-cyan glow-cyan">YOUR DOORS</p>
        <p className="mb-4 font-body text-xs text-white/50">
          Every tag signed in on this browser — up to {MAX_SESSIONS} at once. The
          top door is the active one; every page reads it.
        </p>
        <ul className="space-y-2">
          {accounts.map((a) => {
            const active = a.handle === fren.handle && a.space === fren.space;
            return (
              <li
                key={`${a.handle}@${a.space}`}
                className={`flex flex-wrap items-center gap-3 border-2 px-3 py-2 ${
                  active ? "border-neon/60 bg-neon/5" : "border-edge bg-void"
                }`}
              >
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-coin">
                  {a.handle}
                  <span className={accentText(a.space)}>@{a.space}</span>
                </span>
                {active ? (
                  <span className="font-pixel text-[9px] uppercase text-neon glow-neon">
                    ◆ ACTIVE
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      if (await switchTo(a.handle, a.space)) router.refresh();
                    }}
                    className="cursor-pointer font-pixel text-[9px] uppercase text-cyan underline hover:glow-cyan"
                  >
                    ⇄ SWITCH
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    await signOutOne(a.handle, a.space);
                    router.refresh();
                  }}
                  className="cursor-pointer font-pixel text-[9px] uppercase text-white/40 underline hover:text-ghost"
                >
                  CLOSE THIS DOOR
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Link href="/login" className="button !px-4 !py-2 !text-xs">
            + ADD ANOTHER TAG
          </Link>
          {confirmAllOut ? (
            <span className="flex items-center gap-2">
              <span className="font-pixel text-[9px] uppercase text-ghost">
                CLOSE ALL {accounts.length} DOOR{accounts.length === 1 ? "" : "S"}?
              </span>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  router.push("/");
                }}
                className="cursor-pointer font-pixel text-[9px] uppercase text-ghost underline glow-ghost"
              >
                YES — ALL OUT
              </button>
              <button
                type="button"
                onClick={() => setConfirmAllOut(false)}
                className="cursor-pointer font-pixel text-[9px] uppercase text-white/40 underline"
              >
                STAY
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmAllOut(true)}
              className="cursor-pointer font-pixel text-[9px] uppercase text-white/40 underline hover:text-ghost"
            >
              SIGN OUT EVERYWHERE
            </button>
          )}
        </div>
        {others.length === 0 && (
          <p className="mt-3 font-body text-xs text-white/40">
            one door open — add another tag and switching becomes one press, no re-signing
          </p>
        )}
      </section>

      {/* ── YOUR PROFILE CARD — the kind-0 editor ─────────────────────── */}
      <section className="border-2 border-edge bg-panel p-6">
        <p className="mb-1 font-pixel text-xs text-cyan glow-cyan">YOUR PROFILE CARD</p>
        <p className="mb-4 font-body text-xs text-white/50">
          {signal === "tuning" && "tuning the big relays for your current card…"}
          {signal === "found" && "your live signal, as the nostr network sees it right now."}
          {signal === "silent" &&
            "profile not found on the relays yet — publish your first card below and every nostr app learns your name."}
        </p>
        {fren.npub ? (
          <ProfileEditor
            npub={fren.npub}
            handle={fren.handle}
            space={fren.space}
            nip05Domain={domainForSpace(fren.space)}
            raw={raw}
            signal={signal}
            onPublished={applyLocal}
          />
        ) : (
          <p className="font-pixel text-[9px] uppercase text-ghost">
            NO KEY ON RECORD FOR THIS TAG — THE EDITOR CAN&apos;T VERIFY A SIGNATURE WITHOUT IT
          </p>
        )}
      </section>
    </div>
  );
}
