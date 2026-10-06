"use client";

import Link from "next/link";
import { dedupeAddressable, useNames, useNowMs, useRelayEvents } from "@/lib/doors/useDoors";
import { ago, shortNpub } from "@/lib/doors/format";
import { parseListing } from "@/lib/doors/parse";
import { priceText } from "./MarketView";
import { Empty, Loading, SignerNote } from "./States";

export default function ListingView({ id }: { id: string }) {
  const valid = /^[0-9a-f]{64}$/i.test(id);
  const { events, state } = useRelayEvents(() => (valid ? [{ ids: [id.toLowerCase()] }] : []), [id]);
  const l = dedupeAddressable(events).map(parseListing).find((x) => x && x.id === id.toLowerCase()) ?? null;
  const names = useNames(l ? [l.pubkey] : []);
  const now = useNowMs();

  if (state === "loading") return <Loading what="this listing" />;
  if (!l)
    return (
      <Empty
        head="That listing is not on the relays we read."
        text="It may have been taken down, or it is on a relay we do not listen to yet. The market lists everything we can find."
      />
    );

  return (
    <>
      <p className="door-crumb">
        <Link href="/market">Market</Link>
      </p>
      <section className="door-panel door-hero">
        <p className="door-kicker">{l.cats.filter((c) => c !== "frens").slice(0, 3).join(" · ") || "Listing"}</p>
        <h1 className="door-title door-title--sm">{l.title}</h1>
        <p className="door-stamp door-stamp--money">{priceText(l)}</p>
        <p className="door-ev__old">
          {l.place ? `${l.place} · ` : ""}posted {ago(l.at, now)} ago
        </p>
      </section>
      {l.images.length > 0 && (
        <section className="door-panel door-photos" aria-label="Photos">
          {l.images.map((u) => (
            // seller-supplied external URLs: plain img, bounded
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt="" loading="lazy" referrerPolicy="no-referrer" />
          ))}
        </section>
      )}
      <section className="door-panel">
        <dl className="door-facts">
          <div>
            <dt>Seller</dt>
            <dd>{names[l.pubkey] ?? shortNpub(l.pubkey)}</dd>
          </div>
        </dl>
        {(l.summary || l.desc) && <p className="door-desc">{l.desc || l.summary}</p>}
        <p className="door-fine">Meet in person or trade on trust. Nobody here holds the money.</p>
      </section>
      <section className="door-panel door-center">
        <div className="btn-row door-actions door-actions--two">
          <button type="button" className="glass-btn glass-btn--primary" disabled>Message seller</button>
          <button type="button" className="glass-btn glass-btn--money" disabled>Zap seller</button>
        </div>
        <SignerNote />
      </section>
    </>
  );
}
