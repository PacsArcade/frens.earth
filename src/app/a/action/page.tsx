import type { Metadata } from "next";
import { headers } from "next/headers";
import OperatorGate from "@/components/OperatorGate";
import MergeQueue from "@/components/MergeQueue";
import DecisionsPanel from "@/components/DecisionsPanel";
import SignoffsPanel from "@/components/SignoffsPanel";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";
import { CONSOLE_SITE } from "@/lib/console";

/**
 * DUTY ROSTER — deck 02 of the SCAR Console v2 layout: the admiral's
 * signature desk. Needs-you rides on top: the cross-project SIGN-OFFS board
 * first (fleet-wide approvals with the reader drawer), then the APPROVALS
 * queue carrying the merge → ship stages on one card (① AUTHORIZE & MERGE,
 * ② SHIP), then the DECISION BOARD. The CREW BOARD (in-flight testing,
 * tickets, the rank track, the ship's log) berths beside it at /a/testing.
 * Same key-is-the-operator gate as every /a tab.
 */
export const metadata: Metadata = {
  title: "Duty roster — frens.earth admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminActionItemsPage() {
  const cookie = (await headers()).get("cookie");
  const operator = operatorFromCookieHeader(cookie);
  if (!operator) {
    return <OperatorGate configured={operatorsConfigured()} />;
  }
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 pb-4 pt-10">
        <p className="lcars-eyebrow mb-3" data-accent="pink">
          OPERATOR CONSOLE · {CONSOLE_SITE.domain.toUpperCase()} · DECK 02
        </p>
        <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">DUTY ROSTER</h1>
        <p className="max-w-2xl font-body text-sm text-white/55">
          Everything that needs your signature — cross-project sign-offs up top, then merge a
          proposal and ship it live from the same card, then the decision board. The{" "}
          <b className="text-white/75">crew board</b> (tickets · rank track · ship&apos;s log)
          berths beside this desk in the ribbon.
        </p>
      </div>
      {/* anchors feed the ribbon accordion (SIGN-OFFS / APPROVALS / DECISIONS) */}
      <section id="signoffs" className="scroll-mt-20">
        <SignoffsPanel />
      </section>
      <section id="approvals" className="scroll-mt-20">
        <MergeQueue mode="approvals" />
      </section>
      <section id="decisions" className="scroll-mt-20">
        <DecisionsPanel />
      </section>
    </main>
  );
}
