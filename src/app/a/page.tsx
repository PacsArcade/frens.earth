import type { Metadata } from "next";
import { headers } from "next/headers";
import OperatorGate from "@/components/OperatorGate";
import MergeQueue from "@/components/MergeQueue";
import DecisionsPanel from "@/components/DecisionsPanel";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";
import { CONSOLE_SITE } from "@/lib/console";

/**
 * ACTION ITEMS — SCAR's landing tab and the admiral's signature desk. The
 * APPROVALS queue up top carries the merge → ship stages on one card: open PRs
 * waiting to merge (① AUTHORIZE & MERGE, ② SHIP locked), then merged-but-not-yet-
 * live changes (① MERGE ✓, ② SHIP lit — sign to deploy). A change only crosses
 * to Bug Testing once it's LIVE. The DECISION BOARD sits below. Everything here
 * needs the admiral's key; the node/connection rooms (and the deploy-hook setup)
 * live one tab over. Same key-is-the-operator gate as every /a tab.
 */
export const metadata: Metadata = {
  title: "Action items — frens.earth admin",
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
      <div className="mx-auto max-w-3xl px-6 pb-4 pt-10">
        <p className="lcars-eyebrow mb-3" data-accent="pink">
          OPERATOR CONSOLE · {CONSOLE_SITE.domain.toUpperCase()}
        </p>
        <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">ACTION ITEMS</h1>
        <p className="font-body text-sm text-white/55">
          Everything that needs your signature — merge a proposal, then ship it live from the same
          card. The decision board sits below.
        </p>
      </div>
      {/* anchors feed the ribbon accordion (APPROVALS / DECISIONS) */}
      <section id="approvals" className="scroll-mt-20">
        <MergeQueue mode="approvals" />
      </section>
      <section id="decisions" className="scroll-mt-20">
        <DecisionsPanel />
      </section>
    </main>
  );
}
