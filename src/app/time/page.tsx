import type { Metadata } from "next";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";
import TimeDoor from "@/components/time/TimeDoor";
import Orrery from "@/components/time/orrery/Orrery";
import HalfWheel from "@/components/time/HalfWheel";

/**
 * /time — behind the TIME DOOR. Education-first: THE ORRERY large (the
 * hero — Act I of the orrery study, every ring a bitcoin period around
 * the 624-ember sun), HOW TO READ IT (the orrery taught in a glance,
 * directly under the dial), THE PAPER (Bitcoin Federated Time explained
 * for a curious human — through the orrery, the clock this page actually
 * shows), and THE EXPERIMENT (watch a block land + two converters).
 * Public page; BFT-only dates (house law).
 *
 * DIFFERENT WORLDS, SAME CLOCK (owner ruling 0018.04.28): each site tells
 * the one time its own way, branded and skinned per world — the orrery is
 * EARTH's; the pacman living clock is the ARCADE's (pacsarcade.org/time);
 * DW land will tell it in brass and gears. Acts I·B, II and III of the
 * study stay on the bench, under development.
 *
 * FACELIFT (owner orders, 0018.05.x): the paper teaches THE ORRERY now —
 * every flip-clock passage rewritten (the pacman clock performs at the
 * arcade); typographic emphasis by SIZE (the <Key> treatment — load-bearing
 * phrases step up, sparingly); no mid-token wraps (<NB> pins the tokens
 * that never split; headings balance, paragraphs wrap pretty).
 *
 * OWNER RULING (0018.04.22, binding): any link to "the paper" points to
 * the STANDALONE repo — github.com/PacsArcade/bitcoin-federated-time —
 * never a knowledge-engine copy.
 */

const PAPER_URL = "https://github.com/PacsArcade/bitcoin-federated-time";

export const metadata: Metadata = {
  title: "The Clock — Bitcoin Federated Time — frens.earth",
  description:
    "The clock that syncs to the block, not the sun. Read the orrery, learn the calendar, watch a block land — Bitcoin Federated Time, explained.",
};

/** One passage of the paper — pixel heading + warm body copy. A div, not a
    <section>: the global `section` rule adds 5rem padding + a dashed
    border — page-part chrome, wrong for a paper passage (the old rough
    look). */
function Sect({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="mb-3 text-balance font-pixel text-lg uppercase text-neon">{title}</h2>
      <div className="space-y-3 text-pretty font-body text-sm leading-relaxed text-white/70">
        {children}
      </div>
    </div>
  );
}

/** Typographic emphasis by SIZE (owner ruling: "we can bold and highlight
    text by making the font bigger") — the load-bearing phrase steps up
    from the body's text-sm to text-base and wears the cream. Sparingly. */
function Key({ children }: { children: React.ReactNode }) {
  return <span className="text-base font-semibold text-[#f2ead8]">{children}</span>;
}

/** A token that must never split across lines (house law: "BITCOIN TIME",
    a₿/b₿ datings, ★heights, hh:mm:ss readings, "~10 minutes"). */
function NB({ children }: { children: React.ReactNode }) {
  return <span className="whitespace-nowrap">{children}</span>;
}

/** One entry of HOW TO READ IT — amber pixel label, minimal words. */
function ReadRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-pixel text-[9px] uppercase tracking-widest" style={{ color: "#ffb347" }}>
        {label}
      </dt>
      <dd className="mt-1 text-pretty font-body text-sm leading-relaxed text-white/70">
        {children}
      </dd>
    </div>
  );
}

/** HOW TO READ IT — the orrery taught in a glance, directly under the
    dial (owner order: "showcase how to read what we are showing above").
    Minimal words; the dial itself is the lesson. */
function HowToRead() {
  return (
    <div className="mt-8" aria-label="How to read the orrery">
      <h3 className="mb-1 text-balance font-pixel text-sm uppercase" style={{ color: "#ffb347" }}>
        How to read it
      </h3>
      <p className="mb-4 text-pretty font-body text-sm text-white/70">
        one clock, twelve hands. <Key>every dot carries its reading</Key> — glance at a planet,
        know the value.
      </p>
      <dl className="space-y-3">
        <ReadRow label="the light">
          the sun is the face: <NB>hh:mm:ss</NB> in <NB>BITCOIN TIME</NB>, and the ★height beneath
          it is the sun&apos;s velocity — one block of speed every <NB>~10 minutes</NB>. it
          breathes the 624 pulse: the ten-minute beat raised to light, the <NB>624 nm</NB> ember.
        </ReadRow>
        <ReadRow label="the dots">
          second · minute · hour of 24 · block x of 144 filling the day · day of 28 filling the
          month · month of 13 filling the year · year — bitcoin&apos;s age · halvings so far ·
          generation · last-sat %. every lap fills at the top.
        </ReadRow>
        <ReadRow label="select a ring">
          tap a chip or a planet: the <span className="text-[#ff6600]">orange arc</span> shows
          what&apos;s full, the <span className="text-[#6fd7e0]">blue arc</span> what remains, and the
          dot lights <span className="text-[#ffd700]">gold</span>. the card below names the
          remainder.
        </ReadRow>
        <ReadRow label="the moon">
          rides her own orbit beside MONTH, drawn at her true phase (as the northern sky sees
          her) — the sky&apos;s month against the chain&apos;s.
        </ReadRow>
        <ReadRow label="the 13 houses">
          the <NB>✶ HOUSES</NB> toggle: thirteen wedges, one per month, Ophiuchus restored to his
          seat. the shaded wedge is the current month&apos;s.
        </ReadRow>
        <ReadRow label="set the clock">
          point the whole orrery at any date — pre-genesis is welcome, read honestly in{" "}
          <NB>b₿</NB>, blocks before the light. NOW brings it home.
        </ReadRow>
      </dl>
    </div>
  );
}

function ThePaper() {
  return (
    <div className="mb-12">
      <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
        PART ONE ▸ THE PAPER
      </p>

      <Sect title="The block is the clock">
        <p>
          Every clock you&apos;ve ever read was somebody&apos;s opinion.
          Emperors renamed months, popes deleted days, committees still vote
          on leap seconds. The calendar you were handed has been shoved
          around for centuries by whoever held the pen.
        </p>
        <p>
          Bitcoin keeps time differently. Roughly every ten minutes, the
          whole network agrees that one more block exists — and the count of
          those blocks, the <b className="text-white/90">height</b>, is a
          number every node on earth agrees on. No timezone, no committee,
          no trust. <NB><b className="text-white/90">Bitcoin Federated Time</b></NB>{" "}
          (BFT) is nothing more than that height, read as a calendar.{" "}
          <Key>The date isn&apos;t announced by anyone; it&apos;s computed by
          everyone.</Key> The block doesn&apos;t lie.
        </p>
      </Sect>

      <Sect title="A minute that's ten minutes long">
        <p>
          The tick of this clock is the <b className="text-white/90">beat</b>:
          one block, about ten minutes. 144 beats make a day, six beats make
          an hour — so the face at the heart of the orrery reads like the
          clock you already know, <NB><span className="font-mono text-white/85">hh:mm:ss</span></NB>,
          stepping ten &quot;minutes&quot; per block.
        </p>
        <p>
          Look at THE LIGHT above: the sun carries the face, and the ★height
          beneath it is <Key>the sun&apos;s velocity — one block of speed
          every <NB>~10 minutes</NB></Key>. The seconds live inside the
          block, and blocks are random — ten minutes is only the average —
          so when one runs long the face holds at :59 and visibly strains.
          It never lies; it struggles in the open. That&apos;s why estimates
          wear the <span className="font-mono text-coin">~</span>.
        </p>
        <p>
          Around the light, every ring is one of bitcoin&apos;s periods, and
          every lap fills at the top: block x of 144 fills the day, day x of
          28 fills the month, month x of 13 fills the year. Choose a ring
          and it answers — the orange arc is what&apos;s full, the blue arc
          what remains, the dot lights gold. And when the next block lands,
          every planet steps forward at once.{" "}
          <Key>One clock, twelve hands, no opinions.</Key>
        </p>
      </Sect>

      <Sect title="Thirteen perfect months">
        <p>
          A BFT year is <Key><NB>13 months × 28 days</NB></Key> —
          52,416 blocks, no leap days, no odd-length months, ever. And the
          shape isn&apos;t arbitrary: bitcoin re-tunes its mining difficulty
          every 2,016 blocks, so a month is exactly{" "}
          <b className="text-white/90">two difficulty adjustments</b> — the
          page turns twice a month the way the network re-tunes twice a
          month. A year is 26 of them.
        </p>
        <p>
          The months are 28 days; the moon is not — her real lunation runs
          ~29.53 days, so she keeps her own orbit on the orrery, beside
          MONTH, at her true phase. One moon, everywhere: every phase this
          site shows is the moon actually overhead, never a calendar
          stand-in. And each year carries one of 13 animal signs — the
          traditional twelve plus the 🐈 Astronomical Cat, the famous
          left-out sign, finally seated to match the 13-month year. (Signs
          are for wonder, not finance.)
        </p>
      </Sect>

      <Sect title="The year is bitcoin's age">
        <p>
          Years start at zero: block 0 opened year 0000, and the year is
          simply how many 52,416-block years the chain has lived. So when
          the orrery&apos;s YEAR planet reads 18, it&apos;s telling you{" "}
          <Key>bitcoin is 18 block-years old</Key> — measured by the only
          clock that never lied.
        </p>
        <p>
          The old calendar disagrees, and that&apos;s honest too: early
          blocks came faster than ten minutes, and a BFT year is a clean 364
          days, so block time runs a few months ahead of sun time — on
          purpose. The two counts meet at{" "}
          <b className="text-white/90">Day 0</b> — block 983,664, the new
          moon of <NB><span className="font-mono text-white/85">0018.10.28 a₿</span></NB>,
          just after bitcoin&apos;s eighteenth birthday — when the sun
          finally agrees with what the block already knew. That&apos;s where
          the new calendar begins.
        </p>
      </Sect>

      <Sect title="★ and ~ — the two honest marks">
        <p>
          This clock makes exactly one promise:{" "}
          <Key>every mark on it maps to a chain fact.</Key>{" "}
          <span className="font-mono text-coin">★</span> before a
          number means a real, recorded block height — history every node
          agrees on. <span className="font-mono text-coin">~</span> means an
          estimate — the network was unreachable, or a wall-clock moment was
          converted at <NB>~10 minutes</NB> a block.
        </p>
        <p>
          When the connection drops, the orrery never stops and never
          pretends: it keeps counting on the genesis-anchored estimate,
          wears the ~ on its face, and snaps true the moment the chain
          answers. No fake heartbeats, no frozen faces. You can test both
          marks yourself, just below.
        </p>
      </Sect>

      {/* the paper itself lives in its own standalone repo (owner ruling) */}
      <p className="font-mono text-[11px] uppercase tracking-[0.2em]">
        <a
          href={PAPER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-coin/80 underline underline-offset-4 hover:text-coin"
        >
          read the paper on GitHub ↗
        </a>
      </p>
    </div>
  );
}

export default function TimePage() {
  return (
    /* the same shell as every frens.earth page (owner report: "the time
       page doesn't seem to be a part of the overall template and there is
       no way for me to get back to the main frens.earth page") — the
       banner menu rides on top, the footer closes the deck, the clock
       lives between them untouched. */
    <main className="min-h-screen bg-void">
      <ArcadeHeader />
      <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
        FRENS.EARTH ▸ THE TIME DOOR
      </p>
      <h1 className="mb-3 text-balance font-pixel text-xl uppercase text-neon">
        The clock that syncs to the block, not the sun
      </h1>
      <p className="mb-8 text-pretty font-body text-sm text-white/70">
        This is Bitcoin Federated Time — the arcade&apos;s calendar, counted
        purely in blocks. First the clock, then how to read it, then the
        why, then you get to play with it. Tick tock.
      </p>

      {/* ═══ THE CLOCK — THE ORRERY, this world's way of telling the one
          time (owner ruling 0018.04.28: different worlds, same clock — the
          orrery is EARTH's; the pacman clock performs at pacsarcade.org/time;
          DW land will tell it in brass). A div, not a <section> — the global
          `section` rule adds 5rem padding + a dashed border. */}
      <div className="mb-14 w-full" aria-label="The orrery — every ring is a bitcoin period">
        {/* the heading wears the study's amber — the orrery's own skin */}
        <h2
          className="mb-3 text-balance font-pixel text-lg uppercase"
          style={{ color: "#ffb347" }}
        >
          The Orrery
        </h2>
        <p className="mb-5 text-pretty font-body text-sm text-white/70">
          every ring is a bitcoin period. the chain is the sun. different
          worlds tell the same clock — this one is earth&apos;s.
        </p>
        {/* the full wheel keeps desktop duty; below md the sky folds to the
            HALF-WHEEL — the admiral's horizon telling (bench v12) */}
        <div className="hidden md:block">
          <Orrery />
        </div>
        <div className="md:hidden">
          <HalfWheel />
        </div>
        <HowToRead />
      </div>

      <TimeDoor>
        <ThePaper />
      </TimeDoor>

      <p className="mt-12 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-white/25">
        tick tock, it all comes back to the block
      </p>
      </div>
      <EarthFooter />
    </main>
  );
}
