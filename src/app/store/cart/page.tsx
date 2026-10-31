import type { Metadata } from "next";
import Link from "next/link";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";
import CartView from "@/components/store/CartView";
import { liveAdapter } from "@/lib/payments";

export const metadata: Metadata = { title: "Your cart — frens.earth store" };
export const dynamic = "force-dynamic";

export default function CartPage() {
  return (
    <main className="min-h-screen bg-void text-white">
      <ArcadeHeader />
      <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Link href="/store" className="font-pixel text-[10px] uppercase tracking-wide text-cyan hover:glow-cyan">
          ← the shelf
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">Your cart</h1>
        <CartView railLive={liveAdapter() !== null} />
      </section>
      <EarthFooter />
    </main>
  );
}
