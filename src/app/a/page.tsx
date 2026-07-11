import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import OperatorGate from "@/components/OperatorGate";
import CertCase from "@/components/CertCase";
import AdminNav from "@/components/AdminNav";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";
import { specimenShelf } from "@/lib/certs";

/**
 * The admin deck — one door to every operator room. Linked from the fren
 * menu when an operator session is live; same key-is-the-operator gate as
 * every /a room. Also hosts the cert-case specimen shelf (the dressing-room
 * preview of the NES-box cert art + BFT time rarity).
 */
export const metadata: Metadata = {
  title: "Admin deck — frens.earth",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ROOMS = [
  { href: "/a/scar", label: "SCAR", blurb: "the duty roster — tickets from the frens", accent: "border-coin/50 text-coin" },
  { href: "/a/spaces", label: "SPACES NODE", blurb: "connect spaced · queue · anchor ceremony", accent: "border-neon/50 text-neon" },
  { href: "/a/mud", label: "MUD NODE", blurb: "point at your P.O.K.E. node — test — verified", accent: "border-cyan/50 text-cyan" },
  { href: "/a/brand", label: "DRESSING ROOM", blurb: "brand tester — preview candidate looks", accent: "border-pink/50 text-pink" },
];

export default async function AdminDeckPage() {
  const cookie = (await headers()).get("cookie");
  const operator = operatorFromCookieHeader(cookie);
  if (!operator) {
    return <OperatorGate configured={operatorsConfigured()} />;
  }
  const shelf = specimenShelf();
  return (
    <main className="min-h-screen bg-void">
      <AdminNav current="deck" />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
          OPERATOR CONSOLE ▸ FRENS.EARTH
        </p>
        <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">ADMIN DECK</h1>
        <p className="mb-8 font-mono text-[11px] text-white/50">
          EVERY OPERATOR ROOM, ONE DOOR — KEYS OPEN ALL OF THEM
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {ROOMS.map((r) => (
            <Link key={r.href} href={r.href} className={`border-2 bg-panel p-5 ${r.accent}`}>
              <p className="mb-1 font-pixel text-xs uppercase">{r.label} ▸</p>
              <p className="font-body text-sm text-white/70">{r.blurb}</p>
            </Link>
          ))}
        </div>

        {/* Cert foundry — specimen shelf. Real BFT lore on every case; the
            profile shelf renders the same component once certs have data. */}
        <div className="mt-12">
          <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
            CERT FOUNDRY ▸ CASE SPECIMENS — RARITY BY BITCOIN TIME
          </p>
          <p className="mb-4 max-w-2xl font-body text-sm text-white/60">
            Every cert ships as box art. The block it etched at decides the case — full moons
            mint silver, epoch boundaries mint gold (the Zelda cart), the Bitcoin new year mints
            crystal, and halvings mint the astronomical tier. No randomness: look at the block.
          </p>
          <div className="flex flex-wrap gap-4">
            {shelf.map((c) => (
              <CertCase key={c.code} cert={c} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
