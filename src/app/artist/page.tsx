import type { Metadata } from "next";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";
import ArtistRegistry from "@/components/ArtistRegistry";

/**
 * The artist door — the "claim your fren tag" machine's sibling for ARTISTS,
 * shipped in the Pac's Arcade brand kit (docs/artist-registry.md). Gated
 * behind the artist-training entitlement; inside: request your name on the
 * Spaces protocol, read the live auction board, watch names per-npub.
 */
export const metadata: Metadata = {
  title: "Artist Registry — frens.earth",
  description:
    "Request your name on the Spaces protocol, watch the auction board, keep your names in sight — the artist door of the Pac's Arcade brand kit.",
};

export const dynamic = "force-dynamic";

export default function ArtistPage() {
  return (
    <main className="min-h-screen bg-void">
      <ArcadeHeader />
      <ArtistRegistry />
      <EarthFooter />
    </main>
  );
}
