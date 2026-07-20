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
  const shots = item.media?.images.length ? item.media.images : item.images;

  return (
    <main className="min-h-screen bg-void text-white">
      <ArcadeHeader />
      <section className="mx-auto max-w-2xl px-4 py-10">
        <Link href="/store" className="text-xs text-cyan-300">
          ← the shelf
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-widest">{item.title}</h1>
        {shots.length > 0 && (
          <div className="mt-4">
            {/* product shots come from blob/dev-file URLs — plain img, width-bounded so nothing breaks the column */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shots[0]} alt={item.title} className="w-full max-w-full border border-neutral-800 object-contain" />
            {shots.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {shots.slice(1).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt={`${item.title} — view ${i + 2}`} className="h-20 w-20 border border-neutral-800 object-cover" />
                ))}
              </div>
            )}
          </div>
        )}
        <p className="mt-2 text-sm text-neutral-300">{item.blurb}</p>
        {item.media?.deliverable && (
          <p className="mt-2 text-xs text-cyan-300">
            includes: {item.media.deliverable.label} ({item.media.deliverable.kind} download) — delivered by the
            artist after purchase
          </p>
        )}
        {item.media?.preview && (
          <p className="mt-2 text-xs">
            <a href={item.media.preview} className="text-cyan-300 underline" target="_blank" rel="noopener noreferrer">
              ▶ preview
            </a>
          </p>
        )}
        {item.sku && <p className="mt-2 text-xs text-neutral-500">item № {item.sku}</p>}
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
