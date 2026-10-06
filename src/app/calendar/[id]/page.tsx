import type { Metadata } from "next";
import { DetailShell } from "@/components/doors/Shell";
import EventView from "@/components/doors/EventView";

export const metadata: Metadata = { title: "Event — frens.earth" };

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <DetailShell>
      <EventView id={id} />
    </DetailShell>
  );
}
