"use client";

import { useEffect, useRef, useState } from "react";
import { bftDateTime, estimateHeight } from "@/lib/bb/bft";

interface OrderView {
  id: string;
  state: string;
  lineItems: { itemId: string; title: string; qty: number }[];
  priceSnapshot: { amount: number; currency: string };
  entitlementSubject?: string;
  createdAtMs: number;
  settledAtMs?: number;
}

/** Buyer-honest copy per state — processing is a first-class wait, not a spinner. */
const STATE_COPY: Record<string, { label: string; note: string }> = {
  created: { label: "ORDER OPEN", note: "no invoice yet — hit buy again if you bounced." },
  charge_created: { label: "AWAITING PAYMENT", note: "your invoice is open — pay it and this page updates." },
  processing: {
    label: "ON THE CHAIN",
    note: "payment seen — confirmations take 10–60+ minutes on-chain. Leave this page open or come back; nothing is lost.",
  },
  settled: { label: "PAID ✓", note: "sats landed with the artist. Fulfillment is on its way." },
  fulfilled: { label: "DELIVERED ✓", note: "done and done. 💜" },
  expired: { label: "INVOICE EXPIRED", note: "no harm — invoices time out. Mint a fresh one below; same order." },
  underpaid: { label: "UNDERPAID", note: "the invoice closed short. Mint a fresh invoice below or contact the artist." },
  canceled: { label: "CANCELED", note: "this order is closed." },
  refunded: { label: "REFUNDED", note: "refund issued by the artist." },
  disputed: { label: "IN DISPUTE", note: "the artist is on it." },
};

const IN_FLIGHT = ["created", "charge_created", "processing"];

export default function OrderStatus({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const orderRef = useRef<OrderView | null>(null);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const res = await fetch(`/api/store/orders/${orderId}`, { cache: "no-store" });
        if (!alive) return;
        if (res.status === 404) {
          setMissing(true);
          return;
        }
        const data = await res.json();
        if (alive && data.ok) setOrder(data.order);
      } catch {
        /* keep last known — honestly stale beats fake fresh */
      }
    }
    void tick();
    const t = setInterval(() => {
      const o = orderRef.current;
      if (!o || IN_FLIGHT.includes(o.state)) void tick();
    }, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [orderId]);

  async function recharge() {
    setBusy(true);
    try {
      const res = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) window.location.href = data.payUrl;
      else setBusy(false);
    } catch {
      setBusy(false);
    }
  }

  if (missing) return <p className="mt-8 text-sm text-neutral-400">No such order on this ship.</p>;
  if (!order) return <p className="mt-8 text-sm text-neutral-400">reading the order…</p>;

  const copy = STATE_COPY[order.state] ?? { label: order.state.toUpperCase(), note: "" };
  const canRecharge = ["expired", "underpaid"].includes(order.state);

  return (
    <div className="mt-6">
      <p className="text-lg font-bold tracking-widest">{copy.label}</p>
      <p className="mt-1 text-sm text-neutral-300">{copy.note}</p>
      <div className="mt-6 border border-neutral-700 p-4 text-sm">
        {order.lineItems.map((li) => (
          <p key={li.itemId} className="font-bold">
            {li.title}
          </p>
        ))}
        <p className="mt-1" style={{ color: "#FFD700" }}>
          {order.priceSnapshot.currency === "SATS"
            ? `${order.priceSnapshot.amount.toLocaleString("en-US")} sats`
            : `${(order.priceSnapshot.amount / 100).toFixed(2)} ${order.priceSnapshot.currency}`}
        </p>
        {order.entitlementSubject && (
          <p className="mt-1 text-xs text-cyan-300">unlocks for {order.entitlementSubject}</p>
        )}
        <p className="mt-2 text-xs text-neutral-500">
          placed ~{bftDateTime(estimateHeight(order.createdAtMs))}
          {order.settledAtMs && <> · paid ~{bftDateTime(estimateHeight(order.settledAtMs))}</>}
        </p>
        <p className="mt-1 text-[10px] text-neutral-600">order {order.id}</p>
      </div>
      {canRecharge && (
        <button
          onClick={recharge}
          disabled={busy}
          className="mt-4 min-h-11 touch-manipulation border border-yellow-500 px-4 py-2 text-sm font-bold tracking-widest text-yellow-400 disabled:opacity-40"
        >
          {busy ? "MINTING…" : "MINT A FRESH INVOICE"}
        </button>
      )}
    </div>
  );
}
