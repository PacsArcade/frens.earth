"use client";

import Link from "next/link";
import { useState } from "react";
import type { StoreItem } from "@/lib/store";
import { addToCart } from "@/lib/cart-client";

/** ADD TO CART: size first (same rule as buy), then a clear confirmation and a way to the cart. */
export default function AddToCart({ item, size }: { item: StoreItem; size: string | null }) {
  const sizes = item.sizes ?? [];
  const [added, setAdded] = useState<{ size: string | null; label: string } | null>(null);
  const [error, setError] = useState<{ size: string | null; reason: string } | null>(null);

  if (item.status !== "live") return null;
  if (item.kind === "digital" || item.kind === "package" || item.kind === "service" || item.fulfillment === "digital" || item.fulfillment === "package" || item.fulfillment === "service") {
    return (
      <p className="max-w-sm text-xs text-white/50">
        This one unlocks for your tag, so it is bought on its own with the button below, not in the cart.
      </p>
    );
  }
  const needSize = sizes.length > 0 && !size;

  function add() {
    setError(null);
    const r = addToCart({
      itemId: item.id,
      size: size ?? undefined,
      title: item.title,
      image: item.media?.images[0] ?? item.images[0],
      unit: item.sale ?? item.price,
      shipper: item.partner ?? "self",
    });
    if (!r.ok) {
      setAdded(null);
      setError({ size, reason: r.reason });
      return;
    }
    setAdded({ size, label: `${item.title}${size ? `, size ${size}` : ""}` });
  }

  return (
    <div className="max-w-sm">
      <button type="button" onClick={add} disabled={needSize} className="glass-btn w-full touch-manipulation">
        {needSize ? "PICK A SIZE FIRST" : "ADD TO CART"}
      </button>
      <div aria-live="polite">
        {added && added.size === size && (
          <p className="mt-2 rounded-md border border-edge bg-panel px-3 py-2 text-xs text-white/80" data-testid="added-note">
            Added to your cart: {added.label}.{" "}
            <Link href="/store/cart" className="text-cyan underline">
              Open your cart
            </Link>
          </p>
        )}
        {error && error.size === size && <p className="mt-2 text-xs" style={{ color: "#ff5577" }}>{error.reason}</p>}
      </div>
    </div>
  );
}
