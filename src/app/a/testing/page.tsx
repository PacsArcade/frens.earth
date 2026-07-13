import type { Metadata } from "next";
import { headers } from "next/headers";
import OperatorGate from "@/components/OperatorGate";
import AdminNav from "@/components/AdminNav";
import MergeQueue from "@/components/MergeQueue";
import TicketsPanel from "@/components/TicketsPanel";
import ShipsLog from "@/components/ShipsLog";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";
import { CONSOLE_SITE } from "@/lib/console";

/**
 * BUG TESTING — the crew's side of SCAR, after a signature lands. The IN FLIGHT
 * section (signed → deployed → test-now, with FEEDBACK / SUBMIT A BUG / CLOSE
 * OUT) up top, the DUTY ROSTER (frens' tickets — claim/work/resolve) in the
 * middle, and the SHIP'S LOG of what shipped below. Same key-is-the-operator
 * gate as every /a tab.
 */
export const metadata: Metadata = {
  title: "Bug testing — frens.earth admin",
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
    <main className="min-h-screen console-ground">
      <AdminNav current="testing" />
      <div className="mx-auto max-w-3xl px-6 pb-4 pt-10">
        <p className="lcars-eyebrow mb-3" data-accent="neon">
          OPERATOR CONSOLE · {CONSOLE_SITE.domain.toUpperCase()}
        </p>
        <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">BUG TESTING</h1>
        <p className="font-body text-sm text-white/55">
          Signed &amp; shipped — test it live, work the board, and read what the crew shipped.
        </p>
      </div>
      <MergeQueue mode="testing" />
      <TicketsPanel mode="crew" />
      <ShipsLog />
    </main>
  );
}
