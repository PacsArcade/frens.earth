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
    <main className="r6-home min-h-screen bg-void">
      <ArcadeHeader />

      {/* Hero: one job per screen, the claim flow leads */}
      <section className="overflow-hidden px-6 pb-8 pt-14 text-center">
        <p className="r6-kicker font-pixel">YOUR PATCH OF EARTH</p>
        <h1 className="r6-h1 font-arcade text-5xl leading-tight text-coin glow-coin sm:text-6xl">
          <NeonTitle text="CLAIM YOUR" flickers={{ 2: 1.6, 8: 2.9 }} />
          <br />
          <NeonTitle text="FREN TAG" flickers={{ 1: 2.2, 6: 3.6 }} />
        </h1>
        <p className="r6-lead mx-auto max-w-2xl">
          Your name, your keys. A free <span className="r6-heart">{spaceTag}</span> handle nobody
          can rent, revoke, or reset. Verified on <span className="r6-info">nostr</span> the
          moment you claim it. Tick tock, tied to Bitcoin at the next batch. Your patch of earth.
        </p>
      </section>

      {/* The claim machine: the three steps in one 8-bit panel */}
      <section className="px-6">
        <div className="r6-claim r6-px8 mx-auto max-w-3xl">
          <div className="r6-px8-in">
            <TagClaim
              space={space}
              nip05Domain={nip05Domain}
              onHandlePreview={setPreviewHandle}
              initialHandle={initialHandle}
            />
          </div>
        </div>
        <p className="r6-hint mx-auto max-w-2xl text-center">
          New here?{" "}
          <Link href="/welcome" className="r6-link">
            Walk the welcome path
          </Link>
          . Signer, tag, face, step by step.
        </p>
      </section>

      {/* How it works: four one-liners */}
      <section className="px-6 pb-20 pt-10">
        <p className="r6-lab mb-5 text-center">HOW IT WORKS</p>
        <ul className="r6-four ez-reflow mx-auto max-w-5xl">
          <li>
            <b>1 · FREE TAG</b>
            <p>
              We issue <span className="r6-heart">{spaceTag}</span> names in batches, so yours
              costs nothing.
            </p>
          </li>
          <li>
            <b>2 · YOUR KEYS</b>
            <p>Your tag binds to a key only you hold, and losing the key loses the tag.</p>
          </li>
          <li>
            <b>3 · LIVE NOW</b>
            <p>
              Your tag works today on{" "}
              <a
                href="https://nostr.com"
                target="_blank"
                rel="noopener noreferrer"
                className="r6-link"
              >
                nostr
              </a>
              , shown as verified{" "}
              <span className="r6-info">
                {previewHandle || "you"}@{nip05Domain}
              </span>
              .
            </p>
          </li>
          <li>
            <b>4 · ON-CHAIN</b>
            <p>We anchor new tags to Bitcoin in one batch, so they last for good.</p>
          </li>
        </ul>
      </section>

      <EarthFooter />
    </main>
  );
}
