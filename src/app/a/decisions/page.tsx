import type { Metadata } from "next";
import { headers } from "next/headers";
import OperatorGate from "@/components/OperatorGate";
import DecisionsPanel from "@/components/DecisionsPanel";
import AdminNav from "@/components/AdminNav";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";

/**
 * The Decisions room — pending rulings surface as action cards with Number
 * One's recommendation + a one-click record (the admiral's ask, 0018.04.16 a₿:
 * "i want to be prompted with the actions, and some recommendations, all from
 * the web GUI"). Same key-is-the-operator gate as the rest of /a.
 */
export const metadata: Metadata = {
  title: "Decisions — frens.earth admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminDecisionsPage() {
  const cookie = (await headers()).get("cookie");
  const operator = operatorFromCookieHeader(cookie);
  if (!operator) {
    return <OperatorGate configured={operatorsConfigured()} />;
  }
  return (
    <main className="min-h-screen bg-void">
      <AdminNav current="decisions" />
      <DecisionsPanel />
    </main>
  );
}
