import type { Metadata } from "next";
import { headers } from "next/headers";
import OperatorGate from "@/components/OperatorGate";
import MergeQueue from "@/components/MergeQueue";
import TicketsPanel from "@/components/TicketsPanel";
import RankTrackPanel from "@/components/console/RankTrackPanel";
import ShipsLog from "@/components/ShipsLog";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";
import { CONSOLE_SITE } from "@/lib/console";

/**
 * CREW BOARD — the crew's side of the DUTY ROSTER deck, after a signature
 * lands. The IN FLIGHT section (signed → deployed → test-now, with FEEDBACK /
 * SUBMIT A BUG / CLOSE OUT) up top, the TICKETS board (frens' tickets —
 * claim/work/resolve) in the middle, the restored RANK TRACK (rank · points ·
 * commendations — honor only), and the SHIP'S LOG of what shipped below.
 * Same key-is-the-operator gate as every /a tab.
 */
export const metadata: Metadata = {
  title: "Crew board — frens.earth admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminTestingPage() {
  const cookie = (await headers()).get("cookie");
  const operator = operatorFromCookieHeader(cookie);
  if (!operator) {
    return <OperatorGate configured={operatorsConfigured()} />;
  }
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 pb-4 pt-10">
        <p className="lcars-eyebrow mb-3" data-accent="neon">
          OPERATOR CONSOLE · {CONSOLE_SITE.domain.toUpperCase()} · DECK 02 · THE CREW&apos;S SIDE
        </p>
        <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">CREW BOARD</h1>
        <p className="max-w-2xl font-body text-sm text-white/55">
          Signed &amp; shipped — test it live, work the tickets, climb the ladder, and read what
          the crew shipped.
        </p>
      </div>
      {/* anchors feed the ribbon accordion (IN FLIGHT / TICKETS / RANK TRACK / SHIP'S LOG) */}
      <section id="inflight" className="scroll-mt-20">
        <MergeQueue mode="testing" />
      </section>
      <section id="roster" className="scroll-mt-20">
        <TicketsPanel mode="crew" />
      </section>
      <section id="rank" className="scroll-mt-20 border-t-2 border-edge/60">
        <RankTrackPanel />
      </section>
      <section id="log" className="scroll-mt-20">
        <ShipsLog />
      </section>
    </main>
  );
}
