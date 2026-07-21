import type { Metadata } from "next";
import Link from "next/link";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";
import { listItems, stripPrivateMedia } from "@/lib/store";
import { liveAdapter } from "@/lib/payments";

export const metadata: Metadata = {
  title: "Store — frens.earth",
  description: "The shelf — wares from this ship, paid in bitcoin.",
};

export const dynamic = "force-dynamic";

function satsLabel(n: number): string {
  return `${n.toLocaleString("en-US")} sats`;
}

function fiatLabel(f: { amount: number; currency: string }): string {
  return `${(f.amount / 100).toFixed(2)} ${f.currency}`;
}

export default async function StorePage() {
  // THE LEAK RULE (store.ts): public serialization strips deliverable.blobPath
  const items = (await listItems()).map(stripPrivateMedia);
  const rail = liveAdapter();

  return (
    <main className="min-h-screen bg-void text-white">
      <ArcadeHeader />
      <section className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-widest">THE SHELF</h1>
        <p className="mt-1 text-sm text-cyan-300">
          wares from this ship · paid in bitcoin, straight to the artist
        </p>
        {!rail && (
          <p className="mt-3 border border-cyan-800 px-3 py-2 text-xs text-cyan-300">
            ◌ payment rail not connected — the shelf is browse-only until this ship links its BTCPay
          </p>
        )}

        {items.length === 0 ? (
          <p className="mt-10 text-sm text-neutral-400">No wares on the shelf yet.</p>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {items.map((item) => {
              const effective = item.sale ?? item.price;
              const shot = item.media?.images[0] ?? item.images[0];
              return (
                <li key={item.id} className="border border-neutral-700 p-4">
                  <Link href={`/store/${item.id}`} className="block">
                    {shot && (
                      /* product shots come from blob/dev-file URLs — plain img, bounded so the card never breaks */
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={shot} alt={item.title} className="mb-3 h-40 w-full max-w-full border border-neutral-800 object-cover" />
                    )}
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-bold">{item.title}</span>
                      {item.status === "soldout" && (
                        <span className="text-xs text-neutral-400">SOLD OUT</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-neutral-300">{item.blurb}</p>
                    {item.media?.deliverable && (
                      <p className="mt-1 text-xs text-cyan-300">
                        includes: {item.media.deliverable.label} ({item.media.deliverable.kind} download)
                      </p>
                    )}
                    <p className="mt-2 text-sm" style={{ color: "#FFD700" }}>
                      {effective.sats != null ? satsLabel(effective.sats) : effective.fiat ? fiatLabel(effective.fiat) : ""}
                      {item.sale && <span className="ml-2 text-xs">· ON SALE</span>}
                      {effective.sats != null && effective.fiat && (
                        <span className="ml-2 text-xs text-neutral-400">~{fiatLabel(effective.fiat)}</span>
                      )}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <EarthFooter />
    </main>
  );
}
