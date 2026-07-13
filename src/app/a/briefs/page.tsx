import type { Metadata } from "next";
import { headers } from "next/headers";
import OperatorGate from "@/components/OperatorGate";
import AdminNav from "@/components/AdminNav";
import BriefsPanel from "@/components/BriefsPanel";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";

/**
 * BRIEFS LIBRARY — the design briefs as reviewable tickets. Read the rendered
 * brief, comment, and sign off or send back. The briefs are internal strategy
 * and this repo is PUBLIC, so the content lives ONLY in the dual-driver store
 * (Blob prod / gitignored data dir dev), pulled from a private captains-only
 * repo with the console's connected GitHub token — never committed here.
 * Operators only — same key-is-the-operator gate as every /a tab.
 */
export const metadata: Metadata = {
  title: "Briefs library — frens.earth admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminBriefsPage() {
  const cookie = (await headers()).get("cookie");
  const operator = operatorFromCookieHeader(cookie);
  if (!operator) {
    return <OperatorGate configured={operatorsConfigured()} />;
  }
  return (
    <main className="min-h-screen console-ground">
      <AdminNav current="briefs" />
      <BriefsPanel />
    </main>
  );
}
