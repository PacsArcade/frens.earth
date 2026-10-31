"use client";

import Link from "next/link";
import { useState } from "react";
import { MAX_LINE_QTY } from "@/lib/cart";
import { clearCart, removeLine, setQty, useCart, type CartEntry } from "@/lib/cart-client";
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

function unitMoney(u: CartEntry["unit"]): Money {
  return u.sats != null ? { amount: u.sats, currency: "SATS" } : { amount: u.fiat?.amount ?? 0, currency: u.fiat?.currency ?? "USD" };
}

const field = "mt-1 w-full border border-neutral-700 bg-black px-2 py-2 text-base sm:text-sm";

/** The cart page body: lines, subtotal, address, shipping quote, then the invoice. */
export default function CartView({ railLive }: { railLive: boolean }) {
  const cart = useCart();
  const [email, setEmail] = useState("");
  const [ship, setShip] = useState(EMPTY_SHIP);
  const [shipAddr, setShipAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<{ key: string; q: ShippingQuoteView } | null>(null);

  if (cart.length === 0) {
    return (
      <div className="mt-6 rounded-md border border-edge bg-panel p-4">
        <p className="text-sm text-white/70">Your cart is empty.</p>
        <Link href="/store" className="glass-btn mt-4 inline-flex touch-manipulation">
          BACK TO THE SHELF
        </Link>
      </div>
    );
  }

  const shipper = cart[0].shipper;
  const partner = shipper !== "self";
  const needsQuote = shipper === "printful";
  const addressOk = partner ? shipComplete(ship) : Boolean(ship.name && shipAddr);
  const subSats = cart.every((e) => e.unit.sats != null);
  const subtotal: Money = subSats
    ? { amount: cart.reduce((n, e) => n + (e.unit.sats ?? 0) * e.qty, 0), currency: "SATS" }
    : { amount: cart.reduce((n, e) => n + unitMoney(e.unit).amount * e.qty, 0), currency: unitMoney(cart[0].unit).currency };
  const lines = cart.map((e) => ({ itemId: e.itemId, size: e.size, qty: e.qty }));
  const quoteKey = JSON.stringify([lines, ship]);
  const liveQuote = quote && quote.key === quoteKey ? quote.q : null;
  const shippingBody = partner ? shipBody(ship) : { name: ship.name, address: shipAddr };

  async function post(extra: object) {
    const res = await fetch("/api/store/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines, contact: email ? { email } : undefined, shipping: shippingBody, ...extra }),
    });
    return { res, data: await res.json() };
  }

  async function getRate() {
    setBusy(true);
    setError(null);
    try {
      const { res, data } = await post({ quoteOnly: true });
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
      const { res, data } = await post({ acceptedShippingMinor: liveQuote?.shippingUsdMinor });
      if (res.status === 409 && data.quote) {
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
      clearCart();
      window.location.href = data.payUrl;
    } catch {
      setError("checkout unreachable, try again");
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <ul className="flex flex-col gap-3">
        {cart.map((e) => (
          <li key={`${e.itemId}:${e.size ?? ""}`} className="flex gap-3 rounded-md border border-edge bg-panel p-3">
            <Link href={`/store/${e.itemId}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-sm border border-edge bg-void">
              {e.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.image} alt={e.title} className="h-full w-full object-contain" />
              ) : null}
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/store/${e.itemId}`} className="block text-sm font-bold text-white hover:text-pink">
                {e.title}
              </Link>
              {e.size && <p className="text-xs text-white/60">size {e.size}</p>}
              <p className="mt-1 text-xs" style={{ color: "var(--primary)" }}>
                {formatMoney(unitMoney(e.unit))} each
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2" role="group" aria-label={`quantity for ${e.title}`}>
                  <button
                    type="button"
                    className="btn-pill min-w-11 touch-manipulation"
                    aria-label={`one fewer ${e.title}`}
                    disabled={e.qty <= 1}
                    onClick={() => setQty(e.itemId, e.size, e.qty - 1)}
                  >
                    −
                  </button>
                  <span className="min-w-6 text-center text-sm font-bold" aria-live="polite">{e.qty}</span>
                  <button
                    type="button"
                    className="btn-pill min-w-11 touch-manipulation"
                    aria-label={`one more ${e.title}`}
                    disabled={e.qty >= MAX_LINE_QTY}
                    onClick={() => setQty(e.itemId, e.size, e.qty + 1)}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-pill touch-manipulation"
                  aria-label={`remove ${e.title} from the cart`}
                  onClick={() => removeLine(e.itemId, e.size)}
                >
                  REMOVE
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm font-bold">
        Subtotal: <span style={{ color: "var(--primary)" }}>{formatMoney(subtotal)}</span>
      </p>

      {!railLive ? (
        <p className="mt-4 rounded-md border border-edge bg-panel px-3 py-2 text-xs text-cyan">
          payment rail not connected — buying opens when this ship links its BTCPay
        </p>
      ) : (
        <div className="mt-5 max-w-sm rounded-md border border-edge bg-panel p-4">
          <p className="text-xs text-neutral-300">
            This shelf takes <span className="font-bold">bitcoin</span>, on-chain or lightning, paid straight to the
            artist.
          </p>
          <label className="mt-4 block text-xs text-neutral-400">
            email for your receipt (optional)
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={field} type="email" />
          </label>
          {partner ? (
            <ShipFields value={ship} onChange={setShip} />
          ) : (
            <>
              <label className="mt-2 block text-xs text-neutral-400">
                ship to — name
                <input value={ship.name} onChange={(e) => setShip({ ...ship, name: e.target.value })} className={field} />
              </label>
              <label className="mt-2 block text-xs text-neutral-400">
                address
                <textarea value={shipAddr} onChange={(e) => setShipAddr(e.target.value)} className={field} rows={3} />
              </label>
              <p className="mt-1 text-[10px] text-neutral-500">seen by the artist alone · forgotten ~30 days after delivery</p>
            </>
          )}
          {needsQuote && liveQuote && (
            <div className="mt-4 border border-neutral-700 px-3 py-2 text-xs text-neutral-200" aria-live="polite">
              <p>items: {formatMoney(liveQuote.item)}</p>
              <p>
                shipping ({liveQuote.method}
                {liveQuote.minDays && liveQuote.maxDays ? `, ${liveQuote.minDays} to ${liveQuote.maxDays} days` : ""}):{" "}
                {formatMoney(liveQuote.shipping)}
              </p>
              <p className="mt-1 font-bold">total: {formatMoney(liveQuote.total)}</p>
            </div>
          )}
          {needsQuote && !liveQuote && (
            <button onClick={getRate} disabled={busy || !addressOk} className="glass-btn mt-4 w-full touch-manipulation">
              {busy ? "CHECKING SHIPPING…" : "SEE SHIPPING AND TOTAL"}
            </button>
          )}
          <button
            onClick={buy}
            hidden={needsQuote && !liveQuote}
            disabled={busy || !addressOk}
            className="glass-btn glass-btn--money mt-4 w-full touch-manipulation"
          >
            {busy ? "OPENING INVOICE…" : "BUY WITH BITCOIN"}
          </button>
          {error && <p className="mt-2 text-xs" style={{ color: "#ff5577" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
