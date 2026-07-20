import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";
import BuyPanel from "@/components/store/BuyPanel";
import { getItem } from "@/lib/store";
import { liveAdapter } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const item = await getItem(id);
  return { title: item ? `${item.title} — frens.earth store` : "Store — frens.earth" };
}

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item || item.status === "hidden") notFound();

  const effective = item.sale ?? item.price;

  return (
    <main className="min-h-screen bg-void text-white">
      <ArcadeHeader />
      <section className="mx-auto max-w-2xl px-4 py-10">
        <Link href="/store" className="text-xs text-cyan-300">
          ← the shelf
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-widest">{item.title}</h1>
        <p className="mt-2 text-sm text-neutral-300">{item.blurb}</p>
        <p className="mt-4 text-lg" style={{ color: "#FFD700" }}>
          {effective.sats != null
            ? `${effective.sats.toLocaleString("en-US")} sats`
            : effective.fiat
              ? `${(effective.fiat.amount / 100).toFixed(2)} ${effective.fiat.currency}`
              : ""}
          {item.sale && <span className="ml-2 text-xs">· ON SALE</span>}
        </p>
        <BuyPanel item={item} railLive={liveAdapter() !== null} />
      </section>
      <EarthFooter />
    </main>
  );
}
