import type { Metadata } from "next";
import { headers } from "next/headers";
import OperatorGate from "@/components/OperatorGate";
import AdminNav from "@/components/AdminNav";
import MergeQueue from "@/components/MergeQueue";
import DecisionsPanel from "@/components/DecisionsPanel";
import DeployPanel from "@/components/DeployPanel";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";
import { CONSOLE_SITE } from "@/lib/console";

/**
 * ACTION ITEMS — SCAR's landing tab and the admiral's signature desk. Two
 * stacks, both one signature from done: the APPROVALS queue (open PRs waiting
 * to merge, plus the ConnectGithub setup) up top, the DECISION BOARD below.
 * Everything here needs the admiral's key; the node/connection rooms live one
 * tab over. Same key-is-the-operator gate as every /a tab.
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
    <main className="min-h-screen console-ground">
      <AdminNav current="action" />
      <div className="mx-auto max-w-3xl px-6 pb-4 pt-10">
        <p className="lcars-eyebrow mb-3" data-accent="pink">
          OPERATOR CONSOLE · {CONSOLE_SITE.domain.toUpperCase()}
        </p>
        <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">ACTION ITEMS</h1>
        <p className="font-body text-sm text-white/55">
          Everything that needs your signature — the approvals queue up top, the decision board
          below.
        </p>
      </div>
      <MergeQueue mode="approvals" />
      <DecisionsPanel />
      <div className="mx-auto max-w-3xl px-6 pb-2">
        <p className="lcars-eyebrow mb-2" data-accent="neon">
          SHIP · SIGN TO DEPLOY THE CURRENT MAIN TO PRODUCTION — MERGE ≠ LIVE UNTIL YOU SHIP
        </p>
      </div>
      <DeployPanel mode="ship" />
    </main>
  );
}
