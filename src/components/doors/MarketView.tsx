"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DOORS } from "@/lib/doors/config";
import { dedupeAddressable, useNowMs, useRelayEvents, withAllow } from "@/lib/doors/useDoors";
import { ago } from "@/lib/doors/format";
import { parseListing, satsLabel, type Listing } from "@/lib/doors/parse";
import { Empty, Loading } from "./States";

const PAGE = 16;

export function priceText(l: Listing): string {
  if (l.free) return "free";
  if (l.sats != null) return satsLabel(l.sats, l.period);
  if (l.priceRaw) return l.priceRaw;
  return "ask";
}

export default function MarketView() {
  const { events, state } = useRelayEvents(
    () => [withAllow({ kinds: [30402], limit: 400 }, DOORS.market)],
    [],
  );
  const now = useNowMs();
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [pics, setPics] = useState(false);
  const [satsOnly, setSatsOnly] = useState(false);
  const [page, setPage] = useState(0);

  const all = useMemo(
    () =>
      dedupeAddressable(events)
        .map(parseListing)
        .filter((l): l is Listing => !!l && l.status !== "sold")
        .sort((a, b) => b.at - a.at),
    [events],
  );
  const hide = new Set(DOORS.market.tags);
  const counts = new Map<string, number>();
  for (const l of all) for (const c of new Set(l.cats)) if (!hide.has(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
  const cats = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  if (state === "loading") return <Loading what="listings" />;
  if (all.length === 0)
    return (
      <Empty
        head="Nothing published yet."
        text="Listings anyone with a key can publish will show here, priced in sats. You talk to the seller directly, and nobody here holds the money."
      />
    );

  const needle = q.trim().toLowerCase();
  const rows = all.filter(
    (l) =>
      (cat === "all" || l.cats.includes(cat)) &&
      (!pics || l.images.length > 0) &&
      (!satsOnly || l.sats != null || l.free) &&
      (!needle || `${l.title} ${l.summary} ${l.place ?? ""}`.toLowerCase().includes(needle)),
  );
  const last = Math.max(0, Math.ceil(rows.length / PAGE) - 1);
  const pg = Math.min(page, last);
  const slice = rows.slice(pg * PAGE, pg * PAGE + PAGE);

  return (
    <div className="door-market">
      <aside className="door-panel door-cats" aria-label="Categories">
        <ul>
          <li>
            <button type="button" className="door-cat" aria-pressed={cat === "all"} onClick={() => { setCat("all"); setPage(0); }}>
              <span>all listings</span>
              <em>{all.length}</em>
            </button>
          </li>
          {cats.map(([c, n]) => (
            <li key={c}>
              <button type="button" className="door-cat" aria-pressed={cat === c} onClick={() => { setCat(c); setPage(0); }}>
                <span>{c}</span>
                <em>{n}</em>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="door-market__main">
        <div className="door-searchrow">
          <input
            type="search"
            className="door-input"
            placeholder={`Search ${all.length} listings`}
            aria-label="Search listings"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
          />
          <div className="btn-row door-searchrow__btns">
            <button type="button" className="glass-btn glass-btn--secondary" aria-pressed={pics} onClick={() => { setPics(!pics); setPage(0); }}>
              With pictures
            </button>
            <button type="button" className="glass-btn glass-btn--secondary" aria-pressed={satsOnly} onClick={() => { setSatsOnly(!satsOnly); setPage(0); }}>
              Sats only
            </button>
          </div>
        </div>
        <section className="door-panel door-rowsbox" aria-label="Listings">
          {slice.length === 0 ? (
            <p className="door-state__text">No listings match. Clear the search or pick another category.</p>
          ) : (
            <ul className="door-rows door-rows--dense">
              {slice.map((l) => (
                <li key={l.id}>
                  <Link href={`/market/${l.id}`} className="door-lrow">
                    <span className="door-lrow__price">{priceText(l)}</span>
                    <span className="door-lrow__title">
                      {l.title}
                      {l.images.length > 0 && <span className="door-chip door-chip--pic">Pic</span>}
                    </span>
                    <span className="door-lrow__place">{l.place ?? ""}</span>
                    <span className="door-lrow__age">{ago(l.at, now)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="door-pager">
          <span className="door-fine">
            {rows.length === 0 ? "0 listings" : `${pg * PAGE + 1} to ${pg * PAGE + slice.length} of ${rows.length}`}
          </span>
          <div className="btn-row door-pager__btns">
            <button type="button" className="glass-btn glass-btn--secondary" disabled={pg === 0} onClick={() => setPage(pg - 1)}>Newer</button>
            <button type="button" className="glass-btn glass-btn--secondary" disabled={pg >= last} onClick={() => setPage(pg + 1)}>Older</button>
          </div>
        </div>
      </div>
    </div>
  );
}
