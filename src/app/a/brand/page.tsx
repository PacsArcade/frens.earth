import type { Metadata } from "next";
import { headers } from "next/headers";
import BrandTester from "@/components/BrandTester";
import OperatorGate from "@/components/OperatorGate";
import AdminNav from "@/components/AdminNav";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";

/**
 * The admin side's first room: the brand tester. Operators (pacster@pacsarcade
 * — the eat6 key) preview candidate frens.earth brands on real components and
 * flip between them, so the brand team's official deliverables land into a
 * working harness instead of a slide deck.
 */
export const metadata: Metadata = {
  title: "Brand tester — frens.earth admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminBrandPage() {
  const cookie = (await headers()).get("cookie");
  const operator = operatorFromCookieHeader(cookie);
  if (!operator) {
    return <OperatorGate configured={operatorsConfigured()} />;
  }
  return (
    <div className="min-h-screen bg-void">
      <AdminNav current="brand" />
      <BrandTester />
    </div>
  );
}
