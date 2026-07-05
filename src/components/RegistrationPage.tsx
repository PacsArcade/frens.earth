import Link from "next/link";
import TagClaim from "@/components/TagClaim";

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
 * The registration machine for this deployment's space (see
 * src/lib/identity-config.ts). This site is standalone — its "/" IS this
 * page — so the header logo points home to the arcade.
 */
export default function RegistrationPage({
  space,
  nip05Domain,
}: {
  space: string;
  nip05Domain: string;
}) {
  const spaceTag = `@${space}`;
  const homeHref = "https://pacsarcade.org";
  return (
    <main className="min-h-screen bg-void">
      <header className="border-b-2 border-edge px-6 py-5">
        <nav className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href={homeHref} className="font-pixel text-sm text-coin glow-coin">
            PAC&apos;S ARCADE
          </Link>
          <span className="font-pixel text-xs text-pink glow-pink uppercase">{spaceTag}</span>
        </nav>
      </header>

      {/* Hero — a breathing neon marquee */}
      <section className="overflow-hidden px-6 pb-10 pt-16 text-center">
        <h1 className="font-arcade text-5xl leading-tight text-coin glow-coin sm:text-6xl">
          <NeonTitle text="CLAIM YOUR" flickers={{ 2: 1.6, 8: 2.9 }} />
          <br />
          <NeonTitle text="PLAYER TAG" flickers={{ 4: 2.2, 9: 3.6 }} />
        </h1>
        <p className="mx-auto mt-8 max-w-xl font-body text-lg text-white/80">
          Enter your initials on the board — permanently. A free{" "}
          <span className="text-pink glow-pink">{spaceTag}</span>{" "}handle is your player name across
          the whole arcade and beyond: chat, leaderboards, campaigns. No company owns it. No renewal
          fee. Yours.
        </p>
      </section>

      {/* The claim machine */}
      <section className="px-6 pb-20">
        <TagClaim space={space} nip05Domain={nip05Domain} />
      </section>

      {/* How it works — cabinet cards */}
      <section className="border-t border-dashed border-edge px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
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
            <h3 className="text-cyan">3. USE IT NOW</h3>
            <p className="font-body text-sm text-white/70">
              Your tag works today on{" "}
              <a
                href="https://nostr.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan hover:glow-cyan underline"
              >
                nostr
              </a>{" "}— an open chat
              network no company controls. Post, message, and follow other frens from any nostr
              app. Apps show you as verified <span className="text-cyan">you@{nip05Domain}</span>{" "}
              (looks like an email — it isn&apos;t one).
            </p>
          </div>
          <div className="card text-left">
            <h3 className="text-cyan">4. ON THE CHAIN</h3>
            <p className="font-body text-sm text-white/70">
              At the next batch commit your tag anchors to Bitcoin with a cryptographic proof —
              permanent, uncensorable, portable. Arcade leaderboards and campaign shout-outs
              display it forever.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t-2 border-edge px-6 py-10 text-center">
        <p className="font-pixel text-xs leading-relaxed text-white/40">
          A PROJECT OF THE PAC&apos;S ARCADE NON-PROFIT —{" "}
          <a href="https://pacsarcade.org" className="text-cyan hover:glow-cyan">
            PACSARCADE.ORG
          </a>{" "}·{" "}
          YOUR TAG BELONGS TO YOU — WE NEVER SEE OR STORE YOUR SECRET KEY · POWERED BY THE{" "}
          <a
            href="https://spacesprotocol.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan hover:glow-cyan"
          >
            SPACES PROTOCOL
          </a>
        </p>
      </footer>
    </main>
  );
}
