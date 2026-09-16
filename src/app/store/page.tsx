import type { Metadata } from "next";
import Link from "next/link";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";
import { listItems, stripPrivateMedia, type StoreItem } from "@/lib/store";
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

/** Pure grouping by what the item physically is — read from its title, the
 *  only signal this v1 catalog carries (no dedicated category field yet).
 *  A miscategorized title just falls into "More from the shelf", never lost. */
const CATEGORIES: { label: string; test: (t: string) => boolean }[] = [
  { label: "Tees & Hoodies", test: (t) => /tee|hoodie/.test(t) },
  { label: "Stickers & Sheets", test: (t) => /sticker|sheet/.test(t) },
  { label: "Hats, Bags & More", test: (t) => /cap|beanie|tote|bag|hat/.test(t) },
];

function categorize(items: StoreItem[]): { label: string; items: StoreItem[] }[] {
  const lower = (s: string) => s.toLowerCase();
  const buckets = CATEGORIES.map((c) => ({ label: c.label, items: [] as StoreItem[] }));
  const rest: StoreItem[] = [];
  for (const item of items) {
    const hit = CATEGORIES.findIndex((c) => c.test(lower(item.title)));
    if (hit >= 0) buckets[hit].items.push(item);
    else rest.push(item);
  }
  if (rest.length) buckets.push({ label: "More from the shelf", items: rest });
  return buckets.filter((b) => b.items.length > 0);
}

function ItemCard({ item }: { item: StoreItem }) {
  const effective = item.sale ?? item.price;
  const shot = item.media?.images[0] ?? item.images[0];
  return (
    <li>
      <Link
        href={`/store/${item.id}`}
        className="group flex h-full flex-col overflow-hidden rounded-md border border-edge bg-panel transition-colors hover:border-pink"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-void">
          {shot ? (
            // product shots are external URLs (dev-file or the artist's own repo) — plain img, bounded
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shot}
              alt={item.title}
              className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-pixel text-[9px] text-white/30">
              NO IMAGE YET
            </div>
          )}
          {item.status === "soldout" && (
            <span className="absolute right-2 top-2 rounded-sm border border-edge bg-void/90 px-2 py-1 font-pixel text-[8px] text-white/70">
              SOLD OUT
            </span>
          )}
          {item.partner && (
            <span className="absolute left-2 top-2 rounded-sm border border-edge bg-void/90 px-2 py-1 font-pixel text-[8px] uppercase text-cyan">
              {item.partner === "printful" ? "print-on-demand" : item.partner}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-3">
          <span className="text-sm font-bold leading-snug text-white group-hover:text-pink">{item.title}</span>
          <p className="line-clamp-2 flex-1 text-xs leading-relaxed text-white/50">{item.blurb}</p>
          {item.sizes && item.sizes.length > 0 && (
            <p className="font-pixel text-[8px] uppercase tracking-wide text-white/35">{item.sizes.join(" · ")}</p>
          )}
          <p className="mt-1 text-sm font-bold" style={{ color: "var(--primary)" }}>
            {effective.sats != null ? satsLabel(effective.sats) : effective.fiat ? fiatLabel(effective.fiat) : ""}
            {item.sale && <span className="ml-2 text-[10px] font-normal text-pink">ON SALE</span>}
            {effective.sats != null && effective.fiat && (
              <span className="ml-2 text-[10px] font-normal text-white/40">~{fiatLabel(effective.fiat)}</span>
            )}
          </p>
        </div>
      </Link>
    </li>
  );
}

export default async function StorePage() {
  // THE LEAK RULE (store.ts): public serialization strips deliverable.blobPath
  const items = (await listItems()).map(stripPrivateMedia);
  const rail = liveAdapter();
  const sections = categorize(items);

  return (
    <main className="min-h-screen bg-void text-white">
      <ArcadeHeader />
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="font-pixel text-[10px] uppercase tracking-[0.3em] text-cyan">frens.earth · the arcade&apos;s shelf</p>
        <h1 className="mt-2 font-pixel text-2xl uppercase tracking-widest text-pink pa-glow-pink">The Shelf</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/60">
          wares from this ship, paid in bitcoin, straight to the artist — no middleman, no custodian holding the
          float.
        </p>
        {!rail && (
          <p className="mt-4 rounded-md border border-edge bg-panel px-3 py-2 text-xs text-cyan">
            ◌ payment rail not connected — the shelf is browse-only until this ship links its BTCPay
          </p>
        )}

        {items.length === 0 ? (
          <p className="mt-10 text-sm text-white/40">No wares on the shelf yet.</p>
        ) : (
          <div className="mt-8 flex flex-col gap-12">
            {sections.map((section) => (
              <div key={section.label}>
                <h2 className="font-pixel text-xs uppercase tracking-[0.2em] text-white/50">{section.label}</h2>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {section.items.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
      <EarthFooter />
    </main>
  );
}
