import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";
import { getProduct } from "@/lib/store/products";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Store — frens.earth" };
  return { title: `${product.title} — frens.earth`, description: product.tagline };
}

/* Product page (scaffold). The INSERT COIN pay modal (QR + poll, ported from
   the campaigns ContributeModal) arrives with the design pass — the invoice
   API behind it is already live. docs/STORE-ADDON.md */
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product || product.status === "retired") notFound();
  return (
    <main className="min-h-screen bg-void">
      <ArcadeHeader />
      <div className="px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <p className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-white/40">
            the fren store
          </p>
          <h1 className="font-arcade text-4xl text-coin glow-coin">{product.title}</h1>
          <p className="mt-2 text-white/60">{product.tagline}</p>
          <p className="mt-6 font-pixel text-2xl text-coin">
            {product.priceSats.toLocaleString()} sats
          </p>
          <div className="mt-6 space-y-3 text-white/80">
            <p>{product.summary}</p>
            {product.story.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
          <p className="mt-6 text-sm text-white/60">
            <span className="font-pixel uppercase tracking-widest text-white/40">
              delivery:{" "}
            </span>
            {product.delivery}
          </p>
          {product.status === "live" ? (
            <button
              type="button"
              disabled
              className="mt-10 rounded-xl border border-coin px-6 py-3 font-arcade text-coin opacity-50"
              title="the pay modal ships with the design pass — API is live"
            >
              INSERT COIN — SOON
            </button>
          ) : (
            <p className="mt-10 font-pixel text-sm uppercase tracking-widest text-white/40">
              draft — not on the shelf yet
            </p>
          )}
          <p className="mt-10">
            <Link href="/store" className="text-sm text-white/40 hover:text-white/70">
              ← back to the shelf
            </Link>
          </p>
        </div>
      </div>
      <EarthFooter />
    </main>
  );
}
