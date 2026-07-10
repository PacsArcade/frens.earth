import type { Metadata } from "next";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";
import BbConsole from "@/components/BbConsole";

export const metadata: Metadata = {
  title: "Bitcoin Buddy — frens.earth",
  description:
    "Meet your Bitcoin Buddy — a co-owned virtual pet born at a block and cared for with your key. Sign in with nostr to start. Made with love at Pac's Arcade 💜",
};

/**
 * /bb — the Bitcoin Buddy module. Same shell as every frens.earth page
 * (ArcadeHeader / EarthFooter, the layout's BrandProvider theme); BbConsole
 * gates the content on the existing NIP-07 sign-in.
 */
export default function BbPage() {
  return (
    <main className="min-h-screen bg-void">
      <ArcadeHeader />
      <div className="px-6 py-12">
        <div className="mx-auto mb-8 max-w-md text-center">
          <p className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-white/40">
            FRENS.EARTH ▸ BITCOIN BUDDY
          </p>
          <h1 className="font-arcade text-4xl text-neon glow-neon">BITCOIN BUDDY</h1>
          <p className="mt-3 font-body text-sm text-white/60">
            A lil buddy tied to the block — co-owned with your frens, kept alive
            with your key.
          </p>
        </div>
        <BbConsole />
      </div>
      <EarthFooter />
    </main>
  );
}
