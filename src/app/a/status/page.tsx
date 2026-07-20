import type { Metadata } from "next";
import { headers } from "next/headers";
import OperatorGate from "@/components/OperatorGate";
import StatusReportsPanel from "@/components/StatusReportsPanel";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";
import { CONSOLE_SITE } from "@/lib/console";

/**
 * BRIDGE — deck 01 of the SCAR Console v2 layout: where everything stands,
 * the moment you land. In-flight work with now/next/later priorities plus
 * everything that needs the admiral (sign · review · vote), aggregated live
 * from the console's own boards, with the reader drawer on the right. BRIEFS
 * sits beside it in the ribbon accordion (/a/briefs). Same key-is-the-
 * operator gate as every /a tab.
 */
export const metadata: Metadata = {
  title: "Bridge — frens.earth admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminStatusPage() {
  const cookie = (await headers()).get("cookie");
  const operator = operatorFromCookieHeader(cookie);
  if (!operator) {
    return <OperatorGate configured={operatorsConfigured()} />;
  }
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 pb-4 pt-10">
        <p className="lcars-eyebrow mb-3" data-accent="cyan">
          OPERATOR CONSOLE · {CONSOLE_SITE.domain.toUpperCase()} · DECK 01
        </p>
        <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">BRIDGE</h1>
        <p className="max-w-2xl font-body text-sm text-white/55">
          Where everything stands, the moment you land — the in-flight work and everything that
          needs you (sign · review · vote), each report one select from its reader.{" "}
          <b className="text-white/75">Briefs</b> sits beside it in the ribbon.
        </p>
      </div>
      <StatusReportsPanel />
    </main>
  );
}
