import type { Metadata } from "next";
import DoorShell from "@/components/doors/Shell";
import MarketView from "@/components/doors/MarketView";

export const metadata: Metadata = {
  title: "Market — frens.earth",
  description: "Classifieds from nostr, priced in sats. You talk to the seller directly.",
};

export default function MarketPage() {
  return (
    <DoorShell
      kicker="The old school board, priced in sats"
      title="Market"
      lede="Classifieds from nostr. Text first, fast, no algorithm. Anyone can post, you talk to the seller directly, and nobody here holds the money."
    >
      <MarketView />
    </DoorShell>
  );
}
