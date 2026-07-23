import type { Metadata } from "next";
import TimeDoor from "@/components/time/TimeDoor";

/**
 * /time — behind the TIME DOOR. Education-first: the flip clock large
 * (the hero), THE PAPER (Bitcoin Federated Time explained for a curious
 * human), and THE EXPERIMENT (watch a block land + two converters).
 * Public page; BFT-only dates (house law); adapted from
 * knowledge-engine/docs/BFT.md + docs/bft-display.md.
 */

export const metadata: Metadata = {
  title: "The Clock — Bitcoin Federated Time — frens.earth",
  description:
    "The clock that syncs to the block, not the sun. Read the flip clock, learn the calendar, watch a block land — Bitcoin Federated Time, explained.",
};

/** One section of the paper — pixel heading + warm body copy. */
function Sect({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-pixel text-lg uppercase text-neon">{title}</h2>
      <div className="space-y-3 font-body text-sm leading-relaxed text-white/70">{children}</div>
    </section>
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
          no trust. <b className="text-white/90">Bitcoin Federated Time</b>{" "}
          (BFT) is nothing more than that height, read as a calendar. The
          date isn&apos;t announced by anyone; it&apos;s computed by
          everyone. The block doesn&apos;t lie.
        </p>
      </Sect>

      <Sect title="A minute that's ten minutes long">
        <p>
          The tick of this clock is the <b className="text-white/90">beat</b>:
          one block, about ten minutes. 144 beats make a day, six beats make
          an hour — so the face reads like the clock you already know,
          <span className="font-mono text-white/85"> hh:mm</span>, stepping
          ten &quot;minutes&quot; per block.
        </p>
        <p>
          Look at the flip clock above: the hours and the minute-tens are{" "}
          <b className="text-white/90">chain-exact</b> — calm cards that flip
          only when a real block lands. The last digit is the one card
          allowed to struggle: it shows the coming block filling up, in
          tenths, and it trembles on its hinge because blocks are random —
          ten minutes is only the average. That&apos;s why it wears the{" "}
          <span className="font-mono text-coin">~</span>. One honest
          struggling digit; everything else is fact.
        </p>
      </Sect>

      <Sect title="Thirteen perfect months">
        <p>
          A BFT year is <b className="text-white/90">13 months × 28 days</b> —
          52,416 blocks, no leap days, no odd-length months, ever. And the
          shape isn&apos;t arbitrary: bitcoin re-tunes its mining difficulty
          every 2,016 blocks, so a month is exactly{" "}
          <b className="text-white/90">two difficulty adjustments</b> — the
          page turns twice a month the way the network re-tunes twice a
          month. A year is 26 of them.
        </p>
        <p>
          Because every month is 28 days, the moon rides along for free: one
          lunation per month, new moon on day 01, full around day 15. Every
          new year opens on a new moon, and each year carries one of 13
          animal signs — the traditional twelve plus the 🐈 Astronomical Cat,
          the famous left-out sign, finally seated to match the 13-month
          year. (Signs are for wonder, not finance.)
        </p>
      </Sect>

      <Sect title="The year is bitcoin's age">
        <p>
          Years start at zero: block 0 opened year 0000, and the year is
          simply how many 52,416-block years the chain has lived. So when the
          clock above says year 0018, it&apos;s telling you{" "}
          <b className="text-white/90">bitcoin is 18 block-years old</b> —
          measured by the only clock that never lied.
        </p>
        <p>
          The old calendar disagrees, and that&apos;s honest too: early
          blocks came faster than ten minutes, and a BFT year is a clean 364
          days, so block time runs a few months ahead of sun time — on
          purpose. The two counts meet at{" "}
          <b className="text-white/90">Day 0</b> — block 983,664, the new
          moon of <span className="font-mono text-white/85">0018.10.28 a₿</span>,
          just after bitcoin&apos;s eighteenth birthday — when the sun
          finally agrees with what the block already knew. That&apos;s where
          the new calendar begins.
        </p>
      </Sect>

      <Sect title="★ and ~ — the two honest marks">
        <p>
          This clock makes exactly one promise: every mark on it maps to a
          chain fact. <span className="font-mono text-coin">★</span> before a
          number means a real, recorded block height — history every node
          agrees on. <span className="font-mono text-coin">~</span> means an
          estimate — the network was unreachable, or a wall-clock moment was
          converted at ~10 minutes a block.
        </p>
        <p>
          When the connection drops, the clock never stops and never
          pretends: it keeps counting on the estimate, wears the ~, and
          snaps true the moment the chain answers. No fake heartbeats, no
          frozen faces. You can test both marks yourself, just below.
        </p>
      </Sect>
    </div>
  );
}

export default function TimePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
        FRENS.EARTH ▸ THE TIME DOOR
      </p>
      <h1 className="mb-3 font-pixel text-xl uppercase text-neon">
        The clock that syncs to the block, not the sun
      </h1>
      <p className="mb-8 font-body text-sm text-white/70">
        This is Bitcoin Federated Time — the arcade&apos;s calendar, counted
        purely in blocks. First the clock, then the why, then you get to
        play with it. Tick tock.
      </p>

      <TimeDoor>
        <ThePaper />
      </TimeDoor>

      <p className="mt-12 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-white/25">
        tick tock, it all comes back to the block
      </p>
    </main>
  );
}
