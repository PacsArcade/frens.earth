"use client";

import { useState } from "react";
import type { StoreItem } from "@/lib/store";
import AddToCart from "./AddToCart";
import ShipFields, { EMPTY_SHIP, shipBody, shipComplete } from "./ShipFields";

interface Money {
  amount: number;
  currency: string;
}
interface ShippingQuoteView {
  shipping: Money;
  shippingUsdMinor: number;
  method: string;
  minDays?: number;
  maxDays?: number;
  item: Money;
  total: Money;
}

function formatMoney(m: Money): string {
  return m.currency === "SATS"
    ? `${m.amount.toLocaleString("en-US")} sats`
    : `${(m.amount / 100).toFixed(2)} ${m.currency}`;
}

/**
 * The buy moment — honest to the no-coiner: this shelf takes bitcoin, and
 * the button says so before any invoice appears. Digital/package items buy
 * AS a signed-in fren (the server enforces it; this copy just warns first).
 */
export default function BuyPanel({ item, railLive }: { item: StoreItem; railLive: boolean }) {
  const [email, setEmail] = useState("");
  const [ship, setShip] = useState(EMPTY_SHIP);
  // self-fulfilled items take one free-text address
  const [shipAddr, setShipAddr] = useState("");
  const [size, setSize] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Printful items: the shipping rate the buyer has SEEN, tied to the exact
  // address + size it was quoted for (any edit makes it stale)
  const [quote, setQuote] = useState<{ key: string; q: ShippingQuoteView } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const needsShipping = item.fulfillment === "self" || Boolean(item.partner);
  const needsStructured = Boolean(item.partner);
  const gated = item.kind === "digital" || item.kind === "package";
  const sizes = item.sizes ?? [];
  const needsSize = sizes.length > 0;
  const structuredComplete = shipComplete(ship);
  const shipName = ship.name;
  const needsQuote = item.partner === "printful";
  const quoteKey = JSON.stringify([size, ship]);
  const liveQuote = quote && quote.key === quoteKey ? quote.q : null;

  /** Ask for Printful's shipping rate for this address; creates nothing. */
  async function getRate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          size: size ?? undefined,
          quoteOnly: true,
          contact: email ? { email } : undefined,
          shipping: shipBody(ship),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) setError(data.reason ?? "could not get a shipping rate");
      else setQuote({ key: quoteKey, q: data.quote });
    } catch {
      setError("shipping rate unreachable, try again");
    }
    setBusy(false);
  }

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const shipping = needsStructured
        ? shipBody(ship)
        : needsShipping
          ? { name: shipName, address: shipAddr }
          : undefined;
      const res = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          size: size ?? undefined,
          contact: email ? { email } : undefined,
          shipping,
          acceptedShippingMinor: liveQuote?.shippingUsdMinor,
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data.quote) {
        // the rate moved since it was shown: show the new one, charge nothing
        setQuote({ key: quoteKey, q: data.quote });
        setError("the shipping rate changed, please check the new total");
        setBusy(false);
        return;
      }
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
          <div className="mt-1 flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={size === s}
                onClick={() => setSize(s)}
                className="btn-pill min-w-14 touch-manipulation"
              >
                {s}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <div className="mt-4">
        <AddToCart item={item} size={size} />
      </div>
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
      {needsShipping && !needsStructured && (
        <>
          <label className="mt-2 block text-xs text-neutral-400">
            ship to — name
            <input
              value={shipName}
              onChange={(e) => setShip({ ...ship, name: e.target.value })}
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
      {needsStructured && <ShipFields value={ship} onChange={setShip} />}
      {needsQuote && liveQuote && (
        <div className="mt-4 border border-neutral-700 px-3 py-2 text-xs text-neutral-200" aria-live="polite">
          <p>item: {formatMoney(liveQuote.item)}</p>
          <p>
            shipping ({liveQuote.method}
            {liveQuote.minDays && liveQuote.maxDays ? `, ${liveQuote.minDays} to ${liveQuote.maxDays} days` : ""}):{" "}
            {formatMoney(liveQuote.shipping)}
          </p>
          <p className="mt-1 font-bold">total: {formatMoney(liveQuote.total)}</p>
        </div>
      )}
      {needsQuote && !liveQuote && (
        <button
          onClick={getRate}
          disabled={busy || !structuredComplete || (needsSize && !size)}
          className="glass-btn mt-4 w-full touch-manipulation"
        >
          {busy ? "CHECKING SHIPPING…" : needsSize && !size ? "PICK A SIZE FIRST" : "SEE SHIPPING AND TOTAL"}
        </button>
      )}
      <button
        onClick={buy}
        hidden={needsQuote && !liveQuote}
        disabled={
          busy ||
          (needsStructured ? !structuredComplete : needsShipping && (!shipName || !shipAddr)) ||
          (needsSize && !size)
        }
        className="glass-btn glass-btn--money mt-4 w-full touch-manipulation"
      >
        {busy ? "OPENING INVOICE…" : needsSize && !size ? "PICK A SIZE FIRST" : "BUY WITH BITCOIN"}
      </button>
      {error && <p className="mt-2 text-xs" style={{ color: "#ff5577" }}>{error}</p>}
    </div>
  );
}
