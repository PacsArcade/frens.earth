"use client";

import Link from "next/link";
import { cartCount, useCart } from "@/lib/cart-client";

/** Small cart link with a live count; sits on the shelf and item pages. */
export default function CartLink() {
  const n = cartCount(useCart());
  return (
    <Link
      href="/store/cart"
      className="glass-btn touch-manipulation"
      aria-label={n > 0 ? `cart, ${n} ${n === 1 ? "item" : "items"}` : "cart, empty"}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="20" r="1.5" />
        <circle cx="18" cy="20" r="1.5" />
        <path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L20 7H6" />
      </svg>
      CART
      <span data-testid="cart-count" className="rounded-full border border-white/40 px-2 text-xs leading-5">
        {n}
      </span>
    </Link>
  );
}
