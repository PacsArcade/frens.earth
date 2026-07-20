import type { Metadata } from "next";
import Link from "next/link";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";
import OrderStatus from "@/components/store/OrderStatus";

export const metadata: Metadata = { title: "Your order — frens.earth" };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="min-h-screen bg-void text-white">
      <ArcadeHeader />
      <section className="mx-auto max-w-2xl px-4 py-10">
        <Link href="/store" className="text-xs text-cyan-300">
          ← the shelf
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-widest">YOUR ORDER</h1>
        <OrderStatus orderId={id} />
      </section>
      <EarthFooter />
    </main>
  );
}
