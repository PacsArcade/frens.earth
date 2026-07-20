"use client";

import { useState } from "react";
import type { StoreItem } from "@/lib/store";

/**
 * The buy moment — honest to the no-coiner: this shelf takes bitcoin, and
 * the button says so before any invoice appears. Digital/package items buy
 * AS a signed-in fren (the server enforces it; this copy just warns first).
 */
export default function BuyPanel({ item, railLive }: { item: StoreItem; railLive: boolean }) {
  const [email, setEmail] = useState("");
  const [shipName, setShipName] = useState("");
  const [shipAddr, setShipAddr] = useState("");
  const [size, setSize] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsShipping = item.fulfillment === "self";
  const gated = item.kind === "digital" || item.kind === "package";
  const sizes = item.sizes ?? [];
  const needsSize = sizes.length > 0;

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          size: size ?? undefined,
          contact: email ? { email } : undefined,
          shipping: needsShipping ? { name: shipName, address: shipAddr } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.reason ?? "checkout failed");
        setBusy(false);
        return;
      }
      window.location.href = data.payUrl;
    } catch {
      setError("checkout unreachable — try again");
      setBusy(false);
    }
  }

  if (item.status === "soldout") {
    return <p className="mt-6 text-sm text-neutral-400">SOLD OUT — the shelf restocks when the artist does.</p>;
  }

  if (!railLive) {
    return (
      <p className="mt-6 border border-cyan-800 px-3 py-2 text-xs text-cyan-300">
        ◌ payment rail not connected — buying opens when this ship links its BTCPay
      </p>
    );
  }

  return (
    <div className="mt-6 max-w-sm">
      <p className="text-xs text-neutral-300">
        This shelf takes <span className="font-bold">bitcoin</span> — on-chain or lightning, paid
        straight to the artist. New to bitcoin?{" "}
        <a href="/chat" className="text-cyan-300 underline">
          the attendant can get you started
        </a>
        .
      </p>
      {gated && (
        <p className="mt-2 text-xs text-cyan-300">unlocks for your tag — sign in before buying.</p>
      )}
      {needsSize && (
        <fieldset className="mt-4">
          <legend className="text-xs text-neutral-400">size — pick one before buying</legend>
          <div className="mt-1 flex flex-wrap gap-1">
            {sizes.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={size === s}
                onClick={() => setSize(s)}
                className={`min-h-11 touch-manipulation border px-3 py-1 text-xs ${
                  size === s ? "border-white font-bold text-white" : "border-neutral-600 text-neutral-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {/* text-base on touch = 16px, so iOS doesn't zoom-jump on focus */}
      <label className="mt-4 block text-xs text-neutral-400">
        email for your receipt (optional)
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full border border-neutral-700 bg-black px-2 py-2 text-base sm:text-sm"
          type="email"
        />
      </label>
      {needsShipping && (
        <>
          <label className="mt-2 block text-xs text-neutral-400">
            ship to — name
            <input
              value={shipName}
              onChange={(e) => setShipName(e.target.value)}
              className="mt-1 w-full border border-neutral-700 bg-black px-2 py-2 text-base sm:text-sm"
            />
          </label>
          <label className="mt-2 block text-xs text-neutral-400">
            address
            <textarea
              value={shipAddr}
              onChange={(e) => setShipAddr(e.target.value)}
              className="mt-1 w-full border border-neutral-700 bg-black px-2 py-2 text-base sm:text-sm"
              rows={3}
            />
          </label>
          <p className="mt-1 text-[10px] text-neutral-500">
            seen by the artist alone · forgotten ~30 days after delivery
          </p>
        </>
      )}
      <button
        onClick={buy}
        disabled={busy || (needsShipping && (!shipName || !shipAddr)) || (needsSize && !size)}
        className="mt-4 min-h-11 w-full touch-manipulation border border-yellow-500 px-4 py-2 text-sm font-bold tracking-widest text-yellow-400 disabled:opacity-40"
      >
        {busy ? "OPENING INVOICE…" : needsSize && !size ? "PICK A SIZE FIRST" : "BUY WITH BITCOIN"}
      </button>
      {error && <p className="mt-2 text-xs" style={{ color: "#ff5577" }}>{error}</p>}
    </div>
  );
}
