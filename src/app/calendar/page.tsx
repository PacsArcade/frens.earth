import type { Metadata } from "next";
import DoorShell from "@/components/doors/Shell";
import CalendarView from "@/components/doors/CalendarView";

export const metadata: Metadata = {
  title: "Calendar — frens.earth",
  description: "Meetups, classes and rooms anyone can publish to nostr. Dates in Bitcoin time first.",
};

export default function CalendarPage() {
  return (
    <DoorShell
      kicker="Meetups, classes and rooms"
      title="Calendar"
      lede="Events anyone can publish to nostr and everyone can read. Dates are Bitcoin time first, the old calendar sits small underneath."
    >
      <CalendarView />
    </DoorShell>
  );
}
