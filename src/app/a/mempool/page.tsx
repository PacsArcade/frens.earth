import type { Metadata } from "next";
import { headers } from "next/headers";
import OperatorGate from "@/components/OperatorGate";
import MempoolPanel from "@/components/MempoolPanel";
import AdminNav from "@/components/AdminNav";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";

/**
 * Admin connections — link this deployment to its OWN chain node (a self-hosted
 * mempool instance; the public mempool.space is only the fallback). The fleet
 * reads the block tip + mempool fill through it. Same key-is-the-operator gate
 * as the rest of /a.
 */
export const metadata: Metadata = {
  title: "Chain node — frens.earth admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminMempoolPage() {
  const cookie = (await headers()).get("cookie");
  const operator = operatorFromCookieHeader(cookie);
  if (!operator) {
    return <OperatorGate configured={operatorsConfigured()} />;
  }
  return (
    <main className="min-h-screen console-ground">
      <AdminNav current="mempool" />
      <MempoolPanel />
    </main>
  );
}
