"use client";

import { useState } from "react";
import Link from "next/link";
import TagClaim from "@/components/TagClaim";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";

/* Marquee title: letters CRT-bloom into place on load, then a couple of tubes
   flicker sporadically — once — and the sign burns steady. `flickers` maps
   letter index → flicker start delay (seconds); delays are spaced so no more
   than two letters ever blink at the same time. */
function NeonTitle({ text, flickers }: { text: string; flickers: Record<number, number> }) {
  return (
    <span aria-label={text}>
      {text.split("").map((ch, i) => {
        if (ch === " ") return <span key={i} className="inline-block w-[0.4em]" aria-hidden />;
        const on = `crt-letter-on 0.55s cubic-bezier(0.2, 0.8, 0.3, 1) ${i * 70}ms both`;
        const flick = flickers[i] !== undefined ? `, flicker-once 1.1s linear ${flickers[i]}s 1` : "";
        return (
          <span key={i} aria-hidden className="neon-letter" style={{ animation: on + flick }}>
            {ch}
          </span>
        );
      })}
    </span>
  );
}

/**
 * The registration machine, parameterized by space: /frens issues @frens tags
 * (served at frens.earth's root via the proxy rewrite), /register issues
 * @pacsarcade tags on pacsarcade.org. The route decides the space — the same
 * page works identically on preview deployments and localhost.
 */
export default function RegistrationPage({
  space,
  nip05Domain,
  initialHandle,
}: {
  space: string;
  nip05Domain: string;
  /** Pre-filled tag (?tag=) — GAME OVER's "press start" lands here */
  initialHandle?: string;
}) {
  const spaceTag = `@${space}`;
  // live echo of the tag being typed, so the cards below talk about THEIR name
  const [previewHandle, setPreviewHandle] = useState(initialHandle ?? "");
  return (
    <main className="min-h-screen bg-void">
      <ArcadeHeader />

      {/* Hero — a breathing neon marquee */}
      <section className="overflow-hidden px-6 pb-10 pt-16 text-center">
        <h1 className="font-arcade text-5xl leading-tight text-coin glow-coin sm:text-6xl">
          <NeonTitle text="CLAIM YOUR" flickers={{ 2: 1.6, 8: 2.9 }} />
          <br />
          <NeonTitle text="FREN TAG" flickers={{ 1: 2.2, 6: 3.6 }} />
        </h1>
        <p className="mx-auto mt-8 max-w-xl font-body text-lg text-white/80">
          Your name, your keys — a free{" "}
          <span className="text-pink glow-pink">{spaceTag}</span>{" "}handle nobody can rent, revoke,
          or reset. Verified on{" "}
          <span className="text-cyan">nostr</span>{" "}the moment you claim it; tick tock, tied to
          Bitcoin at the next batch. Your patch of earth.
        </p>
        <p className="mt-4 font-pixel text-[9px] uppercase text-white/40">
          NEW HERE?{" "}
          <Link href="/welcome" className="text-cyan underline hover:glow-cyan">
            WALK THE WELCOME PATH ▸
          </Link>{" "}
          — SIGNER, TAG, FACE, STEP BY STEP
        </p>
      </section>

      {/* The claim machine */}
      <section className="px-6 pb-20">
        <TagClaim
          space={space}
          nip05Domain={nip05Domain}
          onHandlePreview={setPreviewHandle}
          initialHandle={initialHandle}
        />
      </section>

      {/* How it works — cabinet cards */}
      <section className="border-t border-dashed border-edge px-6 py-16">
        <div className="ez-reflow mx-auto grid max-w-5xl auto-rows-fr gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card text-left">
            <h3 className="text-cyan">1. FREE TAG</h3>
            <p className="font-body text-sm text-white/70">
              Pac&apos;s Arcade owns the <span className="text-pink">{spaceTag}</span>{" "}space and
              issues names from it in batches — thousands of tags, one tiny Bitcoin transaction.
              That&apos;s why yours costs nothing.
            </p>
          </div>
          <div className="card text-left">
            <h3 className="text-cyan">2. YOUR KEYS</h3>
            <p className="font-body text-sm text-white/70">
              Your tag binds to a key that only you hold. We can&apos;t log in as you, reset you,
              or take the name back. Losing the key loses the tag — self-custody is the first
              lesson of the arcade.
            </p>
          </div>
          <div className="card text-left">
            <h3 className="text-cyan">3. LIVE NOW</h3>
            <p className="font-body text-sm text-white/70">
              Your tag works today on{" "}
              <a
                href="https://nostr.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan hover:glow-cyan underline"
              >
                nostr
              </a>
              {" "}— an open chat network no company controls. Post, message, and follow
              other frens from any nostr app. Apps show you as verified{" "}
              <span className="text-cyan">{previewHandle || "you"}@{nip05Domain}</span>{" "}
              (looks like an email — it isn&apos;t one).
            </p>
          </div>
          <div className="card text-left">
            <h3 className="text-cyan">4. ON-CHAIN</h3>
            <p className="font-body text-sm text-white/70">
              Every so often — when the queue fills, not every block — we anchor all new tags to
              Bitcoin in one transaction with a cryptographic proof: permanent, uncensorable,
              portable. Your tag already works while it waits; the batch just makes it forever.
            </p>
          </div>
        </div>
      </section>

      {/* The crew entrance — the velvet rope to the operator console. A
          doorway, not a billboard: heartlight marquee, honest fine print
          (the door is a sign-in gate), night-garden palette throughout. */}
      <section className="px-6 pb-20">
        <Link
          href="/a"
          className="crew-rope mx-auto max-w-2xl"
          title="SCAR·LET — the operator console (crew keys only; the door is a sign-in gate)"
        >
          <span className="crew-rope__lights" aria-hidden="true" />
          <span className="crew-rope__kicker">◗ CREW ENTRANCE</span>
          <span className="crew-rope__title">SCAR·LET — The Operator Console</span>
          <span className="crew-rope__blurb">
            Past the velvet rope: the bridge this patch of earth is flown from — decks and duty
            rosters, rank tracks, the block for a clock. Crew keys open it; every fren is welcome
            to walk up and admire the marquee.
          </span>
          <span className="crew-rope__cta">WALK THE CARPET ▸</span>
          <span className="crew-rope__gate">crew keys only · the door is a sign-in gate</span>
        </Link>
      </section>

      <EarthFooter />
    </main>
  );
}
