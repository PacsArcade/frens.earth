import type { Price, StoreItem } from "./store";

/**
 * Cart rules, pure and offline-testable. The browser keeps a cart of
 * {itemId, size?, qty}; the server re-prices everything from the catalog
 * with these functions, so a tampered cart can only ever buy what the shelf
 * really sells at the shelf's own price.
 */

export const MAX_CART_LINES = 10;
export const MAX_LINE_QTY = 10;

export interface CartLine {
  itemId: string;
  size?: string;
  qty: number;
}

export type CartRefusal = { ok: false; reason: string; status: number };

/** Shape check + merge: same item + size becomes one line, qty added. */
export function normalizeCartLines(raw: unknown): { ok: true; lines: CartLine[] } | CartRefusal {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, reason: "your cart is empty", status: 400 };
  }
  if (raw.length > MAX_CART_LINES) {
    return { ok: false, reason: `a cart holds up to ${MAX_CART_LINES} lines`, status: 400 };
  }
  const merged = new Map<string, CartLine>();
  for (const r of raw) {
    const o = (r ?? {}) as Record<string, unknown>;
    const itemId = typeof o.itemId === "string" ? o.itemId.trim() : "";
    const size = typeof o.size === "string" ? o.size.trim() : "";
    const qty = o.qty;
    if (!itemId) return { ok: false, reason: "a cart line is missing its item", status: 400 };
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > MAX_LINE_QTY) {
      return { ok: false, reason: `quantity must be a whole number from 1 to ${MAX_LINE_QTY}`, status: 400 };
    }
    const key = `${itemId}\u0000${size}`;
    const have = merged.get(key);
    const total = (have?.qty ?? 0) + qty;
    if (total > MAX_LINE_QTY) {
      return { ok: false, reason: `quantity must be a whole number from 1 to ${MAX_LINE_QTY}`, status: 400 };
    }
    merged.set(key, { itemId, size: size || undefined, qty: total });
  }
  return { ok: true, lines: [...merged.values()] };
}

export interface ResolvedLine {
  item: StoreItem;
  size?: string;
  qty: number;
  unit: Price;
}

/** Which hands fill the order: a partner name, or "self" (the artist packs it). */
export function shipperOf(item: StoreItem): string {
  return item.partner ?? "self";
}

/**
 * Check every line against the live catalog. `items` maps id to item (a
 * missing id was not found). Refuses, with a plain reason, anything the cart
 * cannot carry: not live, bad size, digital or package goods, two shippers,
 * or prices in two different currencies.
 */
export function resolveCart(
  lines: CartLine[],
  items: Map<string, StoreItem | null>,
): { ok: true; lines: ResolvedLine[]; shipper: string } | CartRefusal {
  const out: ResolvedLine[] = [];
  let shipper: string | null = null;
  let basis: string | null = null;
  for (const l of lines) {
    const item = items.get(l.itemId) ?? null;
    if (!item || item.status !== "live") {
      return { ok: false, reason: "an item in your cart is no longer on the shelf", status: 404 };
    }
    if (item.kind === "digital" || item.kind === "package" || item.fulfillment === "digital" || item.fulfillment === "package") {
      return {
        ok: false,
        reason: `${item.title} unlocks for your tag, so it is bought on its own page, not in the cart`,
        status: 400,
      };
    }
    if (item.fulfillment === "service" || item.kind === "service") {
      return { ok: false, reason: `${item.title} is bought on its own page, not in the cart`, status: 400 };
    }
    const size = l.size ?? "";
    if (item.sizes?.length) {
      if (!item.sizes.includes(size)) {
        return { ok: false, reason: `pick a size for ${item.title}: ${item.sizes.join(" / ")}`, status: 400 };
      }
    } else if (size) {
      return { ok: false, reason: `${item.title} has no sizes`, status: 400 };
    }
    const s = shipperOf(item);
    if (shipper && s !== shipper) {
      return {
        ok: false,
        reason: "print-on-demand items and items the artist packs ship separately, so they need separate carts. Check out one kind, then the other",
        status: 400,
      };
    }
    shipper = s;
    const unit = item.sale ?? item.price;
    const b = unit.sats != null ? "SATS" : unit.fiat ? unit.fiat.currency : "";
    if (!b) return { ok: false, reason: `${item.title} has no price`, status: 400 };
    if (basis && b !== basis) {
      return { ok: false, reason: "your cart mixes items priced in sats with items priced in dollars, so they need separate carts", status: 400 };
    }
    basis = b;
    out.push({ item, size: size || undefined, qty: l.qty, unit });
  }
  return { ok: true, lines: out, shipper: shipper ?? "self" };
}

/** Sum of price x qty, as a Price in the carts' one currency (sats win). */
export function cartSubtotal(lines: ResolvedLine[]): Price {
  let sats = 0;
  let fiat = 0;
  let currency = "";
  let isSats = false;
  for (const l of lines) {
    if (l.unit.sats != null) {
      isSats = true;
      sats += l.unit.sats * l.qty;
    } else if (l.unit.fiat) {
      fiat += l.unit.fiat.amount * l.qty;
      currency = l.unit.fiat.currency;
    }
  }
  return isSats ? { sats } : { fiat: { amount: fiat, currency } };
}

/** The order's lineItems, one per merged line. */
export function orderLineItems(lines: ResolvedLine[]): { itemId: string; title: string; qty: number; size?: string }[] {
  return lines.map((l) => ({ itemId: l.item.id, title: l.item.title, qty: l.qty, size: l.size }));
}
