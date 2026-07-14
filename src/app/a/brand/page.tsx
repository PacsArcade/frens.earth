import type { Metadata } from "next";
import { headers } from "next/headers";
import BrandTester from "@/components/BrandTester";
import CertCase from "@/components/CertCase";
import OperatorGate from "@/components/OperatorGate";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";
import { specimenShelf } from "@/lib/certs";
import { CONSOLE_SITE } from "@/lib/console";

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
    <div className="min-h-screen">
      {/* The room's viewhead — the approved wireframe scale (scar-lcars-wireframe
          · Dressing Room): eyebrow, the BIG room title, the plain-words lede.
          Same head grammar as Status / Action Items / Bug Testing. */}
      <div className="mx-auto max-w-5xl px-6 pb-4 pt-10">
        <p className="lcars-eyebrow mb-3" data-accent="pink">
          OPERATOR CONSOLE · {CONSOLE_SITE.domain.toUpperCase()}
        </p>
        <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">DRESSING ROOM</h1>
        <p className="font-body text-sm text-white/55">
          Where a candidate {CONSOLE_SITE.domain} identity gets{" "}
          <b className="text-white/75">worn by the real components</b> before it goes live. Every
          cert ships as box art — the block it etched at decides the case. No randomness: look at
          the block.
        </p>
      </div>

      {/* Cert foundry — specimen shelf (moved from the old deck). Real BFT lore
          on every case; the profile shelf renders the same component once certs
          have data. The id anchors the ribbon accordion (CERT FOUNDRY).
          Eyebrow wears the room's PINK — the carts may mint gold, the label
          can't (gold = money only). */}
      <div id="certs" className="mx-auto max-w-5xl scroll-mt-20 px-6 pt-6">
        <p className="lcars-eyebrow mb-3" data-accent="pink">
          CERT FOUNDRY · CASE SPECIMENS — THE BLOCK DECIDES THE CASE
        </p>
        <p className="mb-5 max-w-2xl font-body text-sm text-white/60">
          Full moons mint silver, epoch boundaries mint gold (the Zelda cart), the Bitcoin new
          year mints crystal, and halvings mint the astronomical tier.
        </p>
        <div className="flex flex-wrap gap-4">
          {shelf.map((c) => (
            <CertCase key={c.code} cert={c} />
          ))}
        </div>
      </div>

      <section id="tester" className="scroll-mt-20">
        <BrandTester />
      </section>
    </div>
  );
}
