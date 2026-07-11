import type { Metadata } from "next";
import { headers } from "next/headers";
import OperatorGate from "@/components/OperatorGate";
import MudPanel from "@/components/MudPanel";
import AdminNav from "@/components/AdminNav";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";

/**
 * Admin connections — connect this deployment's own P.O.K.E. MUD node. Same
 * key-is-the-operator gate as the rest of /a.
 */
export const metadata: Metadata = {
  title: "MUD node — frens.earth admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminMudPage() {
  const cookie = (await headers()).get("cookie");
  const operator = operatorFromCookieHeader(cookie);
  if (!operator) {
    return <OperatorGate configured={operatorsConfigured()} />;
  }
  return (
    <main className="min-h-screen bg-void">
      <AdminNav current="mud" />
      <MudPanel />
    </main>
  );
}
