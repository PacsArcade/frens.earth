import type { Metadata } from "next";
import { headers } from "next/headers";
import OperatorGate from "@/components/OperatorGate";
import OverviewPanel from "@/components/console/OverviewPanel";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";
import { CONSOLE_SITE } from "@/lib/console";

/**
 * SCAR·LET OVERVIEW — the console FRONT PAGE. "/a" is the room the ribbon's
 * ◗ SCAR·LET brand block opens (◉ HOME in the readout): how the site is doing
 * at a glance, what needs the admiral (real board counts, each a door), and
 * where a first captain begins. The Action Items desk moved to /a/action.
 * Same key-is-the-operator gate as every /a tab.
 */
export const metadata: Metadata = {
  title: "Overview — frens.earth admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ConsoleOverviewPage() {
  const cookie = (await headers()).get("cookie");
  const operator = operatorFromCookieHeader(cookie);
  if (!operator) {
    return <OperatorGate configured={operatorsConfigured()} />;
  }
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 pb-6 pt-10">
        <p className="lcars-eyebrow mb-3" data-accent="cyan">
          ◗ CONSOLE FRONT PAGE · {CONSOLE_SITE.domain.toUpperCase()}
        </p>
        <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">SCAR·LET OVERVIEW</h1>
        <p className="font-body text-sm text-white/55">
          The console&apos;s front page — how <b className="text-white/75">{CONSOLE_SITE.domain}</b>{" "}
          is doing at a glance, and where a first captain begins. The rooms live in the ribbon.
        </p>
      </div>
      <OverviewPanel />
    </main>
  );
}
