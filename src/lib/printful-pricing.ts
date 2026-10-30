import { fetchSyncVariant, placementForFileType, printfulRequest, type PrintfulCall } from "./printful";

/**
 * Printful pricing for the shelf (Admiral's ruling, block 973,766):
 * the shelf price is Printful's cost x 1.21, rounded UP to the cent.
 *
 * Cost = the catalog variant's price for the technique the product prints
 * with (DTG, embroidery, ...) plus the price of each placement the design
 * uses (front is usually 0.00, a back print or sleeve adds money). Source:
 * GET /v2/catalog-variants/{id}/prices (selling region north_america, USD).
 * discounted_price wins when present. A sized item is priced from its BASE
 * size (the first size) and listed at one price; the dearer sizes (2XL and
 * up) are not surcharged here. Said plainly so nobody assumes otherwise.
 *
 * ⚠ The response shape below is read from Printful's v2 docs, NOT yet
 * exercised against the live API from this box. parseVariantCost() is
 * tolerant of both documented layouts and refuses (returns an error) when
 * it cannot find a technique price, rather than guessing a number.
 */

export const MARKUP_NUM = 121;
export const MARKUP_DEN = 100;
export const PRICE_CURRENCY = "USD";

/** "12.95" | 12.95 -> integer cents, or null when it is not a price. */
export function toCents(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.trim()) : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Printful cost (cents) -> shelf price (cents): x 1.21, rounded UP to the
 *  cent. Pure integer arithmetic so there is no float drift at the boundary. */
export function sellPriceCents(costCents: number): number {
  return Math.floor((costCents * MARKUP_NUM + MARKUP_DEN - 1) / MARKUP_DEN);
}

interface PriceRow {
  technique_key?: string;
  technique?: string;
  id?: string;
  placement?: string;
  price?: unknown;
  discounted_price?: unknown;
}

function rowCents(r: PriceRow): number | null {
  return toCents(r.discounted_price ?? r.price);
}

export type CostResult =
  | { ok: true; costCents: number; technique: string; parts: { name: string; cents: number }[] }
  | { ok: false; error: string };

/** Pure: the /prices response + the placements this product uses -> cost. */
export function parseVariantCost(json: unknown, usedPlacements: string[]): CostResult {
  const root = (json as { data?: Record<string, unknown> } | null)?.data;
  if (!root || typeof root !== "object") return { ok: false, error: "prices response had no data" };
  const variant = root.variant as { techniques?: PriceRow[] } | undefined;
  const product = root.product as { placements?: PriceRow[] } | undefined;
  const techniques = variant?.techniques ?? (root.techniques as PriceRow[] | undefined) ?? [];
  const placements = product?.placements ?? (root.placements as PriceRow[] | undefined) ?? [];
  if (techniques.length === 0) return { ok: false, error: "prices response listed no technique price" };

  const keyOf = (r: PriceRow) => r.id ?? r.placement ?? "";
  const used = usedPlacements.length ? usedPlacements : ["front"];
  // live placement ids can carry a suffix (front_large, back_dtg...), so a
  // used "front" also matches a placement id that starts with "front"
  // ONE placement per used one: the exact id when Printful lists it, else
  // the first suffixed one (a tee lists front, front_large... and only one
  // of them is printed)
  const usedRows: PriceRow[] = [];
  for (const u of used) {
    const row =
      placements.find((p) => keyOf(p) === u) ?? placements.find((p) => keyOf(p).startsWith(`${u}_`));
    if (row && !usedRows.includes(row)) usedRows.push(row);
  }

  // the technique: the one the used placements print with, else the only
  // one, else DTG (the house tees and hoodies print DTG)
  const techKey = (t: PriceRow) => t.technique_key ?? t.technique;
  const wanted = usedRows.map((p) => p.technique_key ?? p.technique).find(Boolean);
  const tech =
    techniques.find((t) => techKey(t) === wanted) ??
    (techniques.length === 1 ? techniques[0] : undefined) ??
    techniques.find((t) => techKey(t) === "dtg");
  if (!tech) {
    // names only (no prices), so the next run says what Printful offered
    const offered = techniques.map(techKey).join(", ") || "none";
    const ids = placements.map(keyOf).join(", ") || "none";
    return { ok: false, error: `could not tell which technique this product prints with (techniques: ${offered}; placements: ${ids}; used: ${used.join(", ")})` };
  }
  const techCents = rowCents(tech);
  if (techCents == null) return { ok: false, error: "technique price was not a number" };

  let total = techCents;
  const parts = [{ name: `technique ${String(techKey(tech) ?? "")}`, cents: techCents }];
  for (const row of usedRows) {
    const c = rowCents(row);
    if (c == null) return { ok: false, error: `placement ${keyOf(row)} price was not a number` };
    total += c;
    parts.push({ name: `placement ${keyOf(row)}`, cents: c });
  }
  return { ok: true, costCents: total, technique: String(tech.technique_key ?? tech.technique ?? ""), parts };
}

/** GET /v2/catalog-variants/{id}/prices, 8 s limit, no secret in errors. */
export async function fetchVariantCost(
  catalogVariantId: number | string,
  usedPlacements: string[],
): Promise<CostResult> {
  const q = new URLSearchParams({ selling_region_name: "north_america", currency: PRICE_CURRENCY });
  const call: PrintfulCall<unknown> = await printfulRequest(
    `/v2/catalog-variants/${encodeURIComponent(String(catalogVariantId))}/prices?${q}`,
  );
  if (!call.ok) return { ok: false, error: call.error };
  return parseVariantCost(call.data, usedPlacements);
}

export type ShelfPrice =
  | { ok: true; costCents: number; priceCents: number; technique: string; catalogVariantId: number; parts: { name: string; cents: number }[] }
  | { ok: false; error: string };

/** One sync variant -> its cost and its shelf price (the "Reprice from
 *  Printful" step). Sats are added by the caller, which owns the rate lookup. */
export async function shelfPriceForSyncVariant(syncVariantId: string): Promise<ShelfPrice> {
  const v = await fetchSyncVariant(syncVariantId);
  if (!v.ok) return { ok: false, error: v.error };
  const used = v.info.files.map((f) => placementForFileType(f.type));
  const cost = await fetchVariantCost(v.info.catalogVariantId, used);
  if (!cost.ok) return { ok: false, error: cost.error };
  return {
    ok: true,
    costCents: cost.costCents,
    priceCents: sellPriceCents(cost.costCents),
    technique: cost.technique,
    catalogVariantId: v.info.catalogVariantId,
    parts: cost.parts,
  };
}
