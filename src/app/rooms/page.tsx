import type { Metadata } from "next";
import DoorShell from "@/components/doors/Shell";
import RoomsView from "@/components/doors/RoomsView";

export const metadata: Metadata = {
  title: "Rooms — frens.earth",
  description: "Live and scheduled audio rooms on nostr. Join opens the room in its own tab.",
};

export default function RoomsPage() {
  return (
    <DoorShell
      kicker="Audio rooms on nostr"
      title="Rooms"
      lede="Drop in, listen, raise a hand. Rooms are live spaces published to nostr. Join opens the room in a new tab."
    >
      <RoomsView />
    </DoorShell>
  );
}
