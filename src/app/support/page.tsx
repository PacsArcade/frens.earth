import type { Metadata } from "next";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";
import TicketsPanel from "@/components/TicketsPanel";

/**
 * The customer-facing side of the roster: a fren raises a ticket (or a spark)
 * and watches their own. The crew works them at /a/scar.
 */
export const metadata: Metadata = {
  title: "Support — frens.earth",
  description: "Raise a ticket with the crew — something broken, missing, or a spark of an idea.",
};

export const dynamic = "force-dynamic";

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-void">
      <ArcadeHeader />
      <TicketsPanel mode="support" />
      <EarthFooter />
    </main>
  );
}
