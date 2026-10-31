"use client";

import { useSyncExternalStore } from "react";
import { MAX_CART_LINES, MAX_LINE_QTY } from "./cart";

/**
 * The browser-side cart: localStorage, one key. It stores display facts
 * (title, picture, price) so the cart page paints without a round trip, but
 * the server re-prices every line from the catalog at checkout, so nothing
 * here is trusted for money.
 */

export const CART_KEY = "frens-cart-v1";

export interface CartEntry {
  itemId: string;
  size?: string;
  qty: number;
  title: string;
  image?: string;
  unit: { sats?: number; fiat?: { amount: number; currency: string } };
  /** "printful" / "fourthwall" / "self" — one shipper per cart */
  shipper: string;
}

const EMPTY: CartEntry[] = [];
let cache: { raw: string | null; list: CartEntry[] } = { raw: null, list: EMPTY };
const listeners = new Set<() => void>();

function parse(raw: string | null): CartEntry[] {
  if (!raw) return EMPTY;
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return EMPTY;
    return v.filter(
      (e): e is CartEntry =>
        e && typeof e.itemId === "string" && Number.isInteger(e.qty) && e.qty >= 1 && typeof e.title === "string",
    );
  } catch {
    return EMPTY;
  }
}

function read(): CartEntry[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(CART_KEY);
  } catch {
    /* private mode: an empty cart */
  }
  if (raw !== cache.raw) cache = { raw, list: parse(raw) };
  return cache.list;
}

function write(list: CartEntry[]) {
  try {
    if (list.length === 0) window.localStorage.removeItem(CART_KEY);
    else window.localStorage.setItem(CART_KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: the cart simply does not persist */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === CART_KEY || e.key === null) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** The cart, live. Server render and first paint see an empty cart. */
export function useCart(): CartEntry[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function cartCount(list: CartEntry[]): number {
  return list.reduce((n, e) => n + e.qty, 0);
}

const same = (a: CartEntry, itemId: string, size?: string) => a.itemId === itemId && (a.size ?? "") === (size ?? "");

export type AddResult = { ok: true } | { ok: false; reason: string };

export function addToCart(entry: Omit<CartEntry, "qty">, qty = 1): AddResult {
  const list = read();
  const other = list.find((e) => e.shipper !== entry.shipper);
  if (other) {
    return {
      ok: false,
      reason: "print-on-demand items and items the artist packs ship separately. Check out what is in your cart first, then add this one",
    };
  }
  const have = list.find((e) => same(e, entry.itemId, entry.size));
  if (!have && list.length >= MAX_CART_LINES) return { ok: false, reason: `a cart holds up to ${MAX_CART_LINES} lines` };
  if (have && have.qty + qty > MAX_LINE_QTY) return { ok: false, reason: `you can have up to ${MAX_LINE_QTY} of one item` };
  write(
    have
      ? list.map((e) => (e === have ? { ...e, ...entry, qty: e.qty + qty } : e))
      : [...list, { ...entry, qty }],
  );
  return { ok: true };
}

export function setQty(itemId: string, size: string | undefined, qty: number) {
  const q = Math.max(1, Math.min(MAX_LINE_QTY, qty));
  write(read().map((e) => (same(e, itemId, size) ? { ...e, qty: q } : e)));
}

export function removeLine(itemId: string, size: string | undefined) {
  write(read().filter((e) => !same(e, itemId, size)));
}

export function clearCart() {
  write([]);
}
