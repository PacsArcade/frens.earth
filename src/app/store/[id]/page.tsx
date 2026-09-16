import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";
import BuyPanel from "@/components/store/BuyPanel";
import { getItem, stripPrivateMedia } from "@/lib/store";
import { liveAdapter } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const item = await getItem(id);
  return { title: item ? `${item.title} — frens.earth store` : "Store — frens.earth" };
}

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = await getItem(id);
  if (!raw || raw.status === "hidden") notFound();
  // THE LEAK RULE (store.ts): the item feeds a client component's props —
  // strip the deliverable's private blobPath before anything serializes
  const item = stripPrivateMedia(raw);

  const effective = item.sale ?? item.price;
  const shots = item.media?.images.length ? item.media.images : item.images;

  return (
    <main className="min-h-screen bg-void text-white">
      <ArcadeHeader />
      <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Link href="/store" className="font-pixel text-[10px] uppercase tracking-wide text-cyan hover:glow-cyan">
          ← the shelf
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {item.partner && (
            <span className="rounded-sm border border-edge bg-panel px-2 py-1 font-pixel text-[8px] uppercase text-cyan">
              {item.partner === "printful" ? "print-on-demand · printful" : item.partner}
            </span>
          )}
          {item.status === "soldout" && (
            <span className="rounded-sm border border-edge bg-panel px-2 py-1 font-pixel text-[8px] text-white/60">
              SOLD OUT
            </span>
          )}
        </div>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">{item.title}</h1>

        {shots.length > 0 && (
          <div className="mt-5 overflow-hidden rounded-md border border-edge bg-panel">
            {/* product shots come from blob/dev-file URLs — plain img, width-bounded so nothing breaks the column */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shots[0]} alt={item.title} className="aspect-square w-full max-w-full bg-void object-contain p-6" />
            {shots.length > 1 && (
              <div className="flex flex-wrap gap-2 border-t border-edge p-2">
                {shots.slice(1).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt={`${item.title} — view ${i + 2}`} className="h-20 w-20 rounded-sm border border-edge bg-void object-contain" />
                ))}
              </div>
            )}
          </div>
        )}

        <p className="mt-4 text-sm leading-relaxed text-white/60">{item.blurb}</p>

        {item.media?.deliverable && (
          <p className="mt-2 text-xs text-cyan">
            includes: {item.media.deliverable.label} ({item.media.deliverable.kind} download) — delivered after
            purchase, from your receipt page
          </p>
        )}
        {item.media?.preview && (
          <p className="mt-2 text-xs">
            <a href={item.media.preview} className="text-cyan underline hover:glow-cyan" target="_blank" rel="noopener noreferrer">
              ▶ preview
            </a>
          </p>
        )}
        {item.sku && <p className="mt-2 text-xs text-white/40">item № {item.sku}</p>}

        <p className="mt-5 text-xl font-bold" style={{ color: "var(--primary)" }}>
          {effective.sats != null
            ? `${effective.sats.toLocaleString("en-US")} sats`
            : effective.fiat
              ? `${(effective.fiat.amount / 100).toFixed(2)} ${effective.fiat.currency}`
              : ""}
          {item.sale && <span className="ml-2 text-xs font-normal text-pink">· ON SALE</span>}
          {effective.sats != null && effective.fiat && (
            <span className="ml-2 text-sm font-normal text-white/40">~{(effective.fiat.amount / 100).toFixed(2)} {effective.fiat.currency}</span>
          )}
        </p>

        <div className="mt-5 rounded-md border border-edge bg-panel p-4">
          <BuyPanel item={item} railLive={liveAdapter() !== null} />
        </div>
      </section>
      <EarthFooter />
    </main>
  );
}
