import type { Metadata } from "next";
import { headers } from "next/headers";
import OperatorGate from "@/components/OperatorGate";
import TicketsPanel from "@/components/TicketsPanel";
import MergeQueue from "@/components/MergeQueue";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";

/**
 * SCAR — the crew's side: the MERGE QUEUE (the admiral authorizes merges with
 * a signature) up top, the duty roster below. Same key-is-the-operator gate
 * as the rest of /a.
 */
export const metadata: Metadata = {
  title: "SCAR — frens.earth admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminTicketsPage() {
  const cookie = (await headers()).get("cookie");
  const operator = operatorFromCookieHeader(cookie);
  if (!operator) {
    return <OperatorGate configured={operatorsConfigured()} />;
  }
  return (
    <main className="min-h-screen bg-void pt-10">
      <MergeQueue />
      <TicketsPanel mode="crew" />
    </main>
  );
}
