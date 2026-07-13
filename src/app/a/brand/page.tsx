import type { Metadata } from "next";
import { headers } from "next/headers";
import BrandTester from "@/components/BrandTester";
import CertCase from "@/components/CertCase";
import OperatorGate from "@/components/OperatorGate";
import AdminNav from "@/components/AdminNav";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";
import { specimenShelf } from "@/lib/certs";

/**
 * DRESSING ROOM — where a candidate frens.earth identity gets worn by the REAL
 * components before it goes live. The cert foundry's specimen shelf rides up
 * top (moved off the old deck): every cert ships as box art, and the block it
 * etched at decides the case. The brand tester itself (pick a theme, compare
 * with live, watch the sign-in render in it) sits below. Operators only —
 * same key-is-the-operator gate as every /a tab.
 */
export const metadata: Metadata = {
  title: "Dressing room — frens.earth admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminBrandPage() {
  const cookie = (await headers()).get("cookie");
  const operator = operatorFromCookieHeader(cookie);
  if (!operator) {
    return <OperatorGate configured={operatorsConfigured()} />;
  }
  const shelf = specimenShelf();
  return (
    <div className="min-h-screen console-ground">
      <AdminNav current="brand" />

      {/* Cert foundry — specimen shelf (moved from the old deck). Real BFT lore
          on every case; the profile shelf renders the same component once certs
          have data. */}
      <div className="mx-auto max-w-5xl px-6 pt-10">
        <p className="lcars-eyebrow mb-3" data-accent="coin">
          CERT FOUNDRY · CASE SPECIMENS
        </p>
        <p className="mb-4 max-w-2xl font-body text-sm text-white/60">
          Every cert ships as box art. The block it etched at decides the case — full moons mint
          silver, epoch boundaries mint gold (the Zelda cart), the Bitcoin new year mints crystal,
          and halvings mint the astronomical tier. No randomness: look at the block.
        </p>
        <div className="flex flex-wrap gap-4">
          {shelf.map((c) => (
            <CertCase key={c.code} cert={c} />
          ))}
        </div>
      </div>

      <BrandTester />
    </div>
  );
}
