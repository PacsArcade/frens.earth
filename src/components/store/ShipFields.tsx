"use client";

export interface ShipValues {
  name: string;
  addr1: string;
  addr2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export const EMPTY_SHIP: ShipValues = { name: "", addr1: "", addr2: "", city: "", state: "", zip: "", country: "" };

export function shipComplete(v: ShipValues): boolean {
  return Boolean(v.name && v.addr1 && v.city && v.country);
}

export function shipBody(v: ShipValues) {
  return {
    name: v.name,
    address1: v.addr1,
    address2: v.addr2 || undefined,
    city: v.city,
    state: v.state || undefined,
    zip: v.zip || undefined,
    country: v.country,
  };
}

const field = "mt-1 w-full border border-neutral-700 bg-black px-2 py-2 text-base sm:text-sm";

/** The structured address a fulfillment partner needs (name, street, city, country). */
export default function ShipFields({ value, onChange }: { value: ShipValues; onChange: (v: ShipValues) => void }) {
  const set = (k: keyof ShipValues, v: string) => onChange({ ...value, [k]: v });
  return (
    <>
      <p className="mt-2 text-[10px] text-cyan-300">
        this item ships via a fulfillment partner — a complete address is required
      </p>
      <label className="mt-2 block text-xs text-neutral-400">
        ship to — name
        <input value={value.name} onChange={(e) => set("name", e.target.value)} className={field} />
      </label>
      <label className="mt-2 block text-xs text-neutral-400">
        address
        <input
          value={value.addr1}
          onChange={(e) => set("addr1", e.target.value)}
          placeholder="street address"
          className={field}
        />
      </label>
      <input
        value={value.addr2}
        onChange={(e) => set("addr2", e.target.value)}
        placeholder="apt / suite (optional)"
        aria-label="apt / suite (optional)"
        className="mt-2 w-full border border-neutral-700 bg-black px-2 py-2 text-base sm:text-sm"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          value={value.city}
          onChange={(e) => set("city", e.target.value)}
          placeholder="city"
          aria-label="city"
          className="min-w-32 flex-1 border border-neutral-700 bg-black px-2 py-2 text-base sm:text-sm"
        />
        <input
          value={value.state}
          onChange={(e) => set("state", e.target.value)}
          placeholder="state / province"
          aria-label="state / province"
          className="w-32 border border-neutral-700 bg-black px-2 py-2 text-base sm:text-sm"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          value={value.zip}
          onChange={(e) => set("zip", e.target.value)}
          placeholder="zip / postal code"
          aria-label="zip / postal code"
          className="w-40 border border-neutral-700 bg-black px-2 py-2 text-base sm:text-sm"
        />
        <input
          value={value.country}
          onChange={(e) => set("country", e.target.value.toUpperCase())}
          placeholder="country (US, CA, …)"
          aria-label="country, 2-letter code"
          maxLength={2}
          className="w-40 border border-neutral-700 bg-black px-2 py-2 text-base sm:text-sm"
        />
      </div>
      <p className="mt-1 text-[10px] text-neutral-500">
        country as a 2-letter code (US, CA, GB, …) · seen by the artist and the fulfillment partner alone ·
        forgotten ~30 days after delivery
      </p>
    </>
  );
}
