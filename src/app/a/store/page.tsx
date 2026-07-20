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
  schemaVersion: 2,
  title: "",
  blurb: "",
  images: [],
  media: { images: [] },
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
  railBtcpay?: boolean;
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
      railBtcpay: di.ok ? Boolean(di.rails?.btcpay) : undefined,
    };
  } catch {
    return null;
  }
}

export default function StoreRoom() {
  const [items, setItems] = useState<StoreItem[] | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [attention, setAttention] = useState<string[]>([]);
  const [railBtcpay, setRailBtcpay] = useState(false);
  const [denied, setDenied] = useState(false);
  const [draft, setDraft] = useState<StoreItem>(BLANK);
  const [sizesText, setSizesText] = useState("");
  const [uploading, setUploading] = useState(false);
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
    if (d.railBtcpay !== undefined) setRailBtcpay(d.railBtcpay);
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
      setSizesText("");
      load();
    }
  }

  /** The form's save — folds the comma-separated sizes text into the draft. */
  async function saveDraft() {
    const sizes = sizesText.split(",").map((s) => s.trim()).filter(Boolean);
    await save({ ...draft, sizes: sizes.length ? sizes : undefined });
  }

  function edit(item: StoreItem) {
    setDraft(item);
    setSizesText(item.sizes?.join(", ") ?? "");
  }

  async function toggle(item: StoreItem, status: StoreItem["status"]) {
    await save({ ...item, status });
  }

  /** Product shots → the operator-gated upload route → draft.media.images. */
  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setNote(null);
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", f);
      try {
        const res = await fetch("/api/admin/store/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.ok) {
          setDraft((d) => {
            const media = d.media ?? { images: [] };
            return { ...d, media: { ...media, images: [...media.images, data.url] } };
          });
        } else {
          setNote(data.reason ?? "upload failed");
        }
      } catch {
        setNote("upload unreachable — try again");
      }
    }
    setUploading(false);
  }

  function removeImage(url: string) {
    setDraft((d) => {
      const media = d.media ?? { images: [] };
      return { ...d, media: { ...media, images: media.images.filter((u) => u !== url) } };
    });
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
                  {o.lineItems[0]?.title}
                  {o.lineItems[0]?.size && <span> · size {o.lineItems[0].size}</span>} ·{" "}
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

      {/* the money rails, honestly: one live berth, two SOON berths — the
          fiat plan stays visible without a single fake config form */}
      <h2 className="mt-6 font-bold tracking-widest text-cyan-300">RAILS</h2>
      <ul className="mt-2 space-y-1 text-xs">
        <li className="border border-neutral-700 p-2">
          {railBtcpay ? (
            <span>
              <b>BTCPAY</b> — <span className="text-green-400">LIVE</span> · on-chain + lightning, sats straight
              to you
            </span>
          ) : (
            <span className="text-cyan-300">
              ◌ <b>BTCPAY</b> — NOT CONNECTED · set BTCPAY_URL / BTCPAY_STORE_ID / BTCPAY_API_KEY in env and
              redeploy (env changes need one — house rule 9)
            </span>
          )}
        </li>
        <li className="border border-neutral-800 p-2 text-neutral-500">
          <b>SQUARE</b> — SOON · account recovery pending; wires into this berth at S5
        </li>
        <li className="border border-neutral-800 p-2 text-neutral-500">
          <b>STRIPE</b> — SOON · wires into this berth at S5
        </li>
      </ul>

      <h2 className="mt-6 font-bold tracking-widest text-cyan-300">WARES</h2>
      {items.length === 0 && <p className="mt-2 text-neutral-400">No wares on the shelf yet — add the first below.</p>}
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 border border-neutral-700 p-2"
          >
            <span className="flex items-center gap-2">
              {(item.media?.images[0] ?? item.images[0]) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.media?.images[0] ?? item.images[0]}
                  alt=""
                  className="h-8 w-8 border border-neutral-800 object-cover"
                />
              )}
              <span>
                <b>{item.title}</b>
                {item.sku && <span className="text-neutral-400"> · №{item.sku}</span>} · {item.kind} ·{" "}
                <span style={{ color: "#FFD700" }}>
                  {item.price.sats != null
                    ? `${item.price.sats.toLocaleString("en-US")} sats`
                    : item.price.fiat
                      ? `${(item.price.fiat.amount / 100).toFixed(2)} ${item.price.fiat.currency}`
                      : "no price"}
                </span>{" "}
                · {item.status}
                {item.sizes && item.sizes.length > 0 && (
                  <span className="text-neutral-400"> · {item.sizes.join("/")}</span>
                )}
                {item.media?.deliverable && (
                  <span className="text-cyan-300"> · +{item.media.deliverable.kind}</span>
                )}
              </span>
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
                onClick={() => edit(item)}
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
          <input
            placeholder="item № (sku, optional)"
            value={draft.sku ?? ""}
            onChange={(e) => setDraft({ ...draft, sku: e.target.value || undefined })}
            className="w-44 border border-neutral-700 bg-black px-2 py-2 text-base sm:text-sm"
          />
          <input
            placeholder="sizes, comma-separated (S, M, L, XL)"
            value={sizesText}
            onChange={(e) => setSizesText(e.target.value)}
            className="min-w-64 flex-1 border border-neutral-700 bg-black px-2 py-2 text-base sm:text-sm"
          />
        </div>

        {/* product shots — public by nature; paid deliverables NEVER ride this */}
        <div className="border border-neutral-700 p-2">
          <p className="text-xs text-neutral-400">product shots (png/jpg/webp/gif/avif, up to 4 MB each)</p>
          {(draft.media?.images.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {draft.media?.images.map((url) => (
                <span key={url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-16 w-16 border border-neutral-800 object-cover" />
                  <button
                    onClick={() => removeImage(url)}
                    aria-label="remove image"
                    className="absolute -right-1 -top-1 border border-neutral-500 bg-black px-1 text-[10px]"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            multiple
            disabled={uploading}
            onChange={(e) => {
              void upload(e.target.files);
              e.target.value = "";
            }}
            className="mt-2 block text-xs text-neutral-400"
          />
          {uploading && <p className="mt-1 text-xs text-neutral-400">uploading…</p>}
        </div>

        <input
          placeholder="public preview URL (optional teaser — never the paid file)"
          value={draft.media?.preview ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              media: { ...(draft.media ?? { images: [] }), preview: e.target.value || undefined },
            })
          }
          className="border border-neutral-700 bg-black px-2 py-2 text-base sm:text-sm"
        />

        {/* the deliverable is a LISTING, not a delivery: metadata only */}
        <div className="border border-neutral-700 p-2">
          <p className="text-xs text-neutral-400">digital deliverable (optional) — what the buyer gets</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <select
              value={draft.media?.deliverable?.kind ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  media: {
                    ...(draft.media ?? { images: [] }),
                    deliverable: e.target.value
                      ? {
                          kind: e.target.value as "audio" | "video" | "file",
                          label: draft.media?.deliverable?.label ?? "",
                        }
                      : undefined,
                  },
                })
              }
              className="min-h-11 border border-neutral-700 bg-black px-2 py-2 text-base sm:text-sm"
            >
              <option value="">none</option>
              <option value="audio">audio</option>
              <option value="video">video</option>
              <option value="file">file</option>
            </select>
            {draft.media?.deliverable && (
              <input
                placeholder='label ("full album download")'
                value={draft.media.deliverable.label}
                onChange={(e) =>
                  setDraft((d) =>
                    d.media?.deliverable
                      ? {
                          ...d,
                          media: { ...d.media, deliverable: { ...d.media.deliverable, label: e.target.value } },
                        }
                      : d
                  )
                }
                className="min-w-52 flex-1 border border-neutral-700 bg-black px-2 py-2 text-base sm:text-sm"
              />
            )}
          </div>
          <p className="mt-2 text-xs text-cyan-300">
            listed on the item now · gated download delivery — SOON (S2, the entitlement gate). Until then you
            send it by hand after settle; never upload the paid file as a product shot.
          </p>
        </div>

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
          onClick={() => saveDraft()}
          disabled={uploading}
          className="min-h-11 touch-manipulation border border-yellow-500 px-3 py-1 font-bold text-yellow-400 disabled:opacity-40"
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
              ~{bftDateTime(estimateHeight(o.createdAtMs))} · {o.lineItems[0]?.title}
              {o.lineItems[0]?.size && <span> · size {o.lineItems[0].size}</span>} · {o.state}
              {o.entitlementSubject && <span className="text-cyan-300"> · {o.entitlementSubject}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
