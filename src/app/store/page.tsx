import type { Metadata } from "next";
import Link from "next/link";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";
import { listProducts } from "@/lib/store/products";

export const metadata: Metadata = {
  title: "Store — frens.earth",
  description:
    "The fren store — pay in sats, straight to the operator's own wallet. No middleman, no custodian, no KYC.",
};

/* Store addon shelf (scaffold) — the design pass owns the final look; this
   page proves the content layer end-to-end. docs/STORE-ADDON.md */
export default async function StorePage() {
  const products = (await listProducts()).filter((p) => p.status === "live");
  return (
    <main className="min-h-screen bg-void">
      <ArcadeHeader />
      <div className="px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <p className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-white/40">
            the fren store
          </p>
          <h1 className="font-arcade text-4xl text-coin glow-coin">STORE</h1>
          <p className="mt-3 text-white/60">
            Pay in sats, straight to the operator&apos;s own wallet — no middleman, no
            custodian, no KYC. You hold your keys; we hold the shelf.
          </p>
          {products.length === 0 ? (
            <p className="mt-10 text-white/40">
              The shelves are being stocked. Check back soon, fren.
            </p>
          ) : (
            <ul className="mt-10 space-y-4">
              {products.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/store/${p.slug}`}
                    className="block rounded-xl border border-white/10 p-5 transition-colors hover:border-coin"
                  >
                    <span className="font-arcade text-xl">{p.title}</span>
                    <span className="ml-3 font-pixel text-sm text-coin">
                      {p.priceSats.toLocaleString()} sats
                    </span>
                    <p className="mt-1 text-sm text-white/60">{p.tagline}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <EarthFooter />
    </main>
  );
}
