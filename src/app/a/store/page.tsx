"use client";

import { useCallback, useEffect, useState } from "react";
import { bftDateTime, estimateHeight } from "@/lib/bb/bft";
import type { StoreItem, OrderRecord } from "@/lib/store";

/**
 * /a/store — the artist's shelf manager. The API is the gate (operator
 * session); these screens are the courtesy. Cosmetic edits ride the
 * session; the money-rail config itself stays in env until the private
 * driver ships (spec: template contract sequencing rule).
 */

const BLANK: StoreItem = {
  id: "",
  schemaVersion: 1,
  title: "",
  blurb: "",
  images: [],
  kind: "self",
  price: {},
  fulfillment: "self",
  status: "hidden",
};

interface ShelfData {
  denied: boolean;
  items?: StoreItem[];
  orders?: OrderRecord[];
  attention?: string[];
}

/** Pure fetcher — no state here, so effect and handlers share it cleanly. */
async function fetchShelf(): Promise<ShelfData | null> {
  try {
    const [ci, co] = await Promise.all([
      fetch("/api/admin/store", { cache: "no-store" }),
      fetch("/api/admin/store/orders", { cache: "no-store" }),
    ]);
    if (ci.status === 401) return { denied: true };
    const di = await ci.json();
    const dord = await co.json();
    return {
      denied: false,
      items: di.ok ? di.items : undefined,
      orders: dord.ok ? dord.orders : undefined,
      attention: dord.ok ? dord.needsAttention : undefined,
    };
  } catch {
    return null;
  }
}

export default function StoreRoom() {
  const [items, setItems] = useState<StoreItem[] | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [attention, setAttention] = useState<string[]>([]);
  const [denied, setDenied] = useState(false);
  const [draft, setDraft] = useState<StoreItem>(BLANK);
  const [note, setNote] = useState<string | null>(null);

  const apply = useCallback((d: ShelfData | null) => {
    if (!d) return;
    if (d.denied) {
      setDenied(true);
      return;
    }
    if (d.items) setItems(d.items);
    if (d.orders) setOrders(d.orders);
    if (d.attention) setAttention(d.attention);
  }, []);

  const load = useCallback(async () => apply(await fetchShelf()), [apply]);

  useEffect(() => {
    let alive = true;
    async function first() {
      const d = await fetchShelf();
      if (alive) apply(d);
    }
    void first();
    return () => {
      alive = false;
    };
  }, [apply]);

  async function save(item: StoreItem) {
    const res = await fetch("/api/admin/store", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    const data = await res.json();
    setNote(data.ok ? null : data.reason);
    if (data.ok) {
      setDraft(BLANK);
      load();
    }
  }

  async function toggle(item: StoreItem, status: StoreItem["status"]) {
    await save({ ...item, status });
  }

  async function fulfill(id: string) {
    await fetch("/api/admin/store/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "fulfill" }),
    });
    load();
  }

  if (denied) {
    return (
      <p className="p-6 text-sm text-cyan-300">
        operator session required —{" "}
        <a href="/a" className="underline">
          sign in at the console door
        </a>
        .
      </p>
    );
  }
  if (!items) return <p className="p-6 text-sm text-neutral-400">reading the shelf…</p>;

  return (
    <div className="p-6 text-sm">
      <h1 className="text-lg font-bold tracking-widest">STORE — the shelf manager</h1>

      {attention.length > 0 && (
        <div className="mt-4 border border-pink-600 p-3">
          <p className="font-bold text-pink-400">NEEDS YOU — paid, not yet fulfilled</p>
          {orders
            .filter((o) => attention.includes(o.id))
            .map((o) => (
              <div key={o.id} className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span>
                  {o.lineItems[0]?.title} ·{" "}
                  <span style={{ color: "#FFD700" }}>
                    {o.priceSnapshot.currency === "SATS"
                      ? `${o.priceSnapshot.amount.toLocaleString("en-US")} sats`
                      : `${(o.priceSnapshot.amount / 100).toFixed(2)} ${o.priceSnapshot.currency}`}
                  </span>
                  {o.entitlementSubject && <span className="text-cyan-300"> → {o.entitlementSubject}</span>}
                  {o.shipping?.name && <span className="text-neutral-400"> · ship to {o.shipping.name}</span>}
                </span>
                <button
                  onClick={() => fulfill(o.id)}
                  className="min-h-11 touch-manipulation border border-neutral-500 px-3 py-1 text-xs"
                >
                  MARK FULFILLED
                </button>
              </div>
            ))}
        </div>
      )}

      <h2 className="mt-6 font-bold tracking-widest text-cyan-300">WARES</h2>
      {items.length === 0 && <p className="mt-2 text-neutral-400">No wares on the shelf yet — add the first below.</p>}
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 border border-neutral-700 p-2"
          >
            <span>
              <b>{item.title}</b> · {item.kind} ·{" "}
              <span style={{ color: "#FFD700" }}>
                {item.price.sats != null
                  ? `${item.price.sats.toLocaleString("en-US")} sats`
                  : item.price.fiat
                    ? `${(item.price.fiat.amount / 100).toFixed(2)} ${item.price.fiat.currency}`
                    : "no price"}
              </span>{" "}
              · {item.status}
            </span>
            {/* thumb-sized controls that wrap instead of shrinking (Module 6) */}
            <span className="flex flex-wrap gap-1">
              {item.status !== "live" && (
                <button
                  onClick={() => toggle(item, "live")}
                  className="min-h-11 touch-manipulation border border-neutral-500 px-3 py-1 text-xs"
                >
                  GO LIVE
                </button>
              )}
              {item.status === "live" && (
                <button
                  onClick={() => toggle(item, "hidden")}
                  className="min-h-11 touch-manipulation border border-neutral-500 px-3 py-1 text-xs"
                >
                  HIDE
                </button>
              )}
              {item.status !== "soldout" && (
                <button
                  onClick={() => toggle(item, "soldout")}
                  className="min-h-11 touch-manipulation border border-neutral-500 px-3 py-1 text-xs"
                >
                  SOLD OUT
                </button>
              )}
              <button
                onClick={() => setDraft(item)}
                className="min-h-11 touch-manipulation border border-neutral-500 px-3 py-1 text-xs"
              >
                EDIT
              </button>
            </span>
          </li>
        ))}
      </ul>

      <h2 className="mt-6 font-bold tracking-widest text-cyan-300">{draft.id ? `EDIT — ${draft.id}` : "ADD A WARE"}</h2>
      <div className="mt-2 grid max-w-md gap-2">
        {/* text-base on touch = 16px, so iOS doesn't zoom-jump on focus */}
        <input
          placeholder="title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          className="border border-neutral-700 bg-black px-2 py-2 text-base sm:text-sm"
        />
        <input
          placeholder="blurb"
          value={draft.blurb}
          onChange={(e) => setDraft({ ...draft, blurb: e.target.value })}
          className="border border-neutral-700 bg-black px-2 py-2 text-base sm:text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={draft.kind}
            onChange={(e) =>
              setDraft({ ...draft, kind: e.target.value as StoreItem["kind"], fulfillment: e.target.value as StoreItem["kind"] })
            }
            className="min-h-11 border border-neutral-700 bg-black px-2 py-2 text-base sm:text-sm"
          >
            <option value="self">merch (you ship)</option>
            <option value="digital">digital</option>
            <option value="package">package (tier)</option>
            <option value="service">service</option>
          </select>
          <input
            placeholder="price in sats"
            type="number"
            value={draft.price.sats ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, price: { ...draft.price, sats: e.target.value ? Number(e.target.value) : undefined } })
            }
            className="w-36 border border-neutral-700 bg-black px-2 py-2 text-base sm:text-sm"
          />
          <input
            placeholder="sale sats"
            type="number"
            value={draft.sale?.sats ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, sale: e.target.value ? { sats: Number(e.target.value) } : undefined })
            }
            className="w-28 border border-neutral-700 bg-black px-2 py-2 text-base sm:text-sm"
          />
        </div>
        <button
          onClick={() => save(draft)}
          className="min-h-11 touch-manipulation border border-yellow-500 px-3 py-1 font-bold text-yellow-400"
        >
          SAVE
        </button>
        {note && <p className="text-xs" style={{ color: "#ff5577" }}>{note}</p>}
      </div>

      <h2 className="mt-6 font-bold tracking-widest text-cyan-300">ORDER BOOK</h2>
      {orders.length === 0 ? (
        <p className="mt-2 text-neutral-400">No orders yet — an honest empty book.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {orders.map((o) => (
            <li key={o.id} className="text-xs text-neutral-300">
              ~{bftDateTime(estimateHeight(o.createdAtMs))} · {o.lineItems[0]?.title} · {o.state}
              {o.entitlementSubject && <span className="text-cyan-300"> · {o.entitlementSubject}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
