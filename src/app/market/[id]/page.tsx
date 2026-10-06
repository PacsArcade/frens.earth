import type { Metadata } from "next";
import { DetailShell } from "@/components/doors/Shell";
import ListingView from "@/components/doors/ListingView";

export const metadata: Metadata = { title: "Listing — frens.earth" };

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <DetailShell>
      <ListingView id={id} />
    </DetailShell>
  );
}
