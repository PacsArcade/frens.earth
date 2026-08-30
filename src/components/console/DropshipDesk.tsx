"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrderRecord, DropshipState } from "@/lib/store";

interface DropshipView {
  order: OrderRecord;
  partner: "printful" | "fourthwall";
  itemTitle: string;
  bridgeNote?: string;
  productUrl?: string;
}

const STATE_CHIP: Record<DropshipState, { className: string; label: string }> = {
  draft_pending: { className: "border-neutral-600 text-neutral-400", label: "not configured yet" },
  draft_created: { className: "border-yellow-500 text-yellow-400", label: "draft ready — needs your confirm" },
  draft_failed: { className: "border-pink-600 text-pink-400", label: "draft failed" },
  submitted: { className: "border-cyan-600 text-cyan-300", label: "submitted — in production" },
  submit_failed: { className: "border-pink-600 text-pink-400", label: "submit failed" },
  shipped: { className: "border-green-600 text-green-400", label: "shipped" },
  manual_bridge: { className: "border-cyan-600 text-cyan-300", label: "manual bridge — Fourthwall" },
  cancel_needed: { className: "border-pink-600 text-pink-400", label: "needs a manual cancel" },
};

/**
 * THE PENDING-FULFILLMENT DESK (S6 ruling 6, ported from vanilla-template's
 * Lane C). Every order carrying a drop-ship partner line lands here the
 * moment it settles — a Printful draft costs the artist nothing; "Confirm &
 * submit" is the ONE button that spends against their balance, always the
 * operator's own click. A Fourthwall line gets the honest manual-bridge
 * story instead of a fake automation button (fourthwall.ts's own header
 * explains why).
 */
export default function DropshipDesk() {
  const [views, setViews] = useState<DropshipView[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    fetch("/api/admin/store/dropship", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) setViews(d.views ?? []);
      })
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function act(orderId: string, action: "create-draft" | "confirm" | "refresh" | "mark-fulfilled") {
    setBusy(orderId);
    setNote((n) => ({ ...n, [orderId]: "" }));
    try {
      const res = await fetch("/api/admin/store/dropship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action }),
      });
      const d = await res.json().catch(() => null);
      if (!d?.ok) setNote((n) => ({ ...n, [orderId]: d?.reason ?? "that didn't take" }));
      else if (d.result?.note) setNote((n) => ({ ...n, [orderId]: d.result.note }));
    } catch {
      setNote((n) => ({ ...n, [orderId]: "unreachable — try again" }));
    }
    setBusy(null);
    load();
  }

  // still open when a REAL fetch hasn't landed at all — an empty array
  // (nothing pending) renders nothing, same silent-empty convention the
  // WARES/ORDER BOOK sections on this page already keep
  if (views === null || views.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="font-bold tracking-widest text-cyan-300">PENDING FULFILLMENT</h2>
      <ul className="mt-2 space-y-2">
        {views.map(({ order, partner, itemTitle, bridgeNote, productUrl }) => {
          const ds = order.dropship;
          const state = ds?.state ?? "draft_pending";
          const chip = STATE_CHIP[state];
          return (
            <li key={order.id} className="border border-neutral-700 p-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <b>{itemTitle}</b>{" "}
                  <span className="text-neutral-400">
                    · {partner} · order {order.id.slice(0, 8)} · {order.shipping?.name ?? "no name on file"}
                  </span>
                </span>
                <span className={`border px-2 py-0.5 text-[10px] ${chip.className}`}>{chip.label}</span>
              </div>

              {ds?.lastError && <p className="mt-1" style={{ color: "#ff5577" }}>{ds.lastError}</p>}
              {bridgeNote && state === "manual_bridge" && (
                <p className="mt-1 text-neutral-400">
                  {bridgeNote}
                  {productUrl && (
                    <>
                      {" — "}
                      <a href={productUrl} target="_blank" rel="noreferrer" className="text-cyan-300 underline">
                        open the product link ↗
                      </a>
                    </>
                  )}
                </p>
              )}
              {ds?.partnerOrderId && (
                <p className="mt-1 text-neutral-500">
                  partner order #{ds.partnerOrderId}
                  {ds.trackingNumber && ` · tracking ${ds.trackingNumber}`}
                  {ds.trackingUrl && (
                    <>
                      {" "}
                      <a href={ds.trackingUrl} target="_blank" rel="noreferrer" className="text-cyan-300 underline">
                        track ↗
                      </a>
                    </>
                  )}
                </p>
              )}

              <div className="mt-2 flex flex-wrap gap-2">
                {(state === "draft_pending" || state === "draft_failed") && partner === "printful" && (
                  <button
                    onClick={() => act(order.id, "create-draft")}
                    disabled={busy === order.id}
                    className="min-h-11 touch-manipulation border border-neutral-500 px-3 py-1 text-xs disabled:opacity-40"
                  >
                    {busy === order.id ? "Working…" : "Create draft"}
                  </button>
                )}
                {state === "draft_created" && (
                  <button
                    onClick={() => {
                      if (confirm("Submit this to Printful for real fulfillment? This spends against your Printful balance.")) {
                        act(order.id, "confirm");
                      }
                    }}
                    disabled={busy === order.id}
                    className="min-h-11 touch-manipulation border border-yellow-500 px-3 py-1 text-xs font-bold text-yellow-400 disabled:opacity-40"
                  >
                    {busy === order.id ? "Working…" : "Confirm & submit ⚡"}
                  </button>
                )}
                {state === "submit_failed" && (
                  <button
                    onClick={() => act(order.id, "confirm")}
                    disabled={busy === order.id}
                    className="min-h-11 touch-manipulation border border-neutral-500 px-3 py-1 text-xs disabled:opacity-40"
                  >
                    {busy === order.id ? "Working…" : "Retry submit"}
                  </button>
                )}
                {state === "submitted" && (
                  <button
                    onClick={() => act(order.id, "refresh")}
                    disabled={busy === order.id}
                    className="min-h-11 touch-manipulation border border-neutral-600 px-3 py-1 text-xs text-neutral-300 disabled:opacity-40"
                  >
                    {busy === order.id ? "Checking…" : "Refresh status"}
                  </button>
                )}
                {state === "manual_bridge" && order.state === "settled" && (
                  <button
                    onClick={() => act(order.id, "mark-fulfilled")}
                    disabled={busy === order.id}
                    className="min-h-11 touch-manipulation border border-neutral-500 px-3 py-1 text-xs disabled:opacity-40"
                  >
                    {busy === order.id ? "Working…" : "Mark fulfilled ✓"}
                  </button>
                )}
                {state === "cancel_needed" && (
                  <span style={{ color: "#ff5577" }}>
                    cancel this manually at {partner === "printful" ? "Printful" : "Fourthwall"} — the order was
                    {order.state === "disputed" ? " disputed" : " refunded"} after it went out
                  </span>
                )}
              </div>
              {note[order.id] && <p className="mt-1 text-neutral-400">{note[order.id]}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
