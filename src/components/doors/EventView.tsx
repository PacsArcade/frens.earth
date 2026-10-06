"use client";

import Link from "next/link";
import { dedupeAddressable, useNames, useRelayEvents, useTip } from "@/lib/doors/useDoors";
import { bftStamp, oldDate, shortNpub } from "@/lib/doors/format";
import { parseCal } from "@/lib/doors/parse";
import { Empty, Loading, SignerNote } from "./States";

export default function EventView({ id }: { id: string }) {
  const valid = /^[0-9a-f]{64}$/i.test(id);
  const { events, state } = useRelayEvents(() => (valid ? [{ ids: [id.toLowerCase()] }] : []), [id]);
  const ev = dedupeAddressable(events).map(parseCal).find((e) => e && e.id === id.toLowerCase()) ?? null;
  const tip = useTip();
  const names = useNames(ev ? [ev.pubkey] : []);
  const rsvp = useRelayEvents(() => (ev ? [{ kinds: [31925], "#a": [ev.coord], limit: 200 }] : []), [ev?.coord]);

  if (state === "loading" || !tip.ready) return <Loading what="this event" />;
  if (!ev)
    return (
      <Empty
        head="That event is not on the relays we read."
        text="It may have been removed, or it is on a relay we do not listen to yet. The calendar lists everything we can find."
      />
    );

  const going = new Set(
    rsvp.events
      .filter((r) => r.tags.some((t) => t[0] === "status" && t[1] === "accepted"))
      .map((r) => r.pubkey),
  ).size;
  const host = names[ev.pubkey] ?? shortNpub(ev.pubkey);

  return (
    <>
      <p className="door-crumb">
        <Link href="/calendar">Calendar</Link>
      </p>
      <section className="door-panel door-hero">
        <p className="door-kicker">{ev.allDay ? "All day event" : "Event"}</p>
        <h1 className="door-title door-title--sm">{ev.title}</h1>
        <p className="door-stamp">{bftStamp(ev.startMs, tip.height, tip.at, !ev.allDay)} a₿</p>
        <p className="door-ev__old">{oldDate(ev.startMs, !ev.allDay)}</p>
      </section>
      <section className="door-panel">
        <dl className="door-facts">
          <div>
            <dt>Place</dt>
            <dd>{ev.place ?? "Not listed"}</dd>
          </div>
          <div>
            <dt>Online room</dt>
            <dd>
              {ev.roomLink ? (
                <a href={ev.roomLink} target="_blank" rel="noopener noreferrer" className="door-link">
                  {ev.roomLink.replace(/^https?:\/\//, "").slice(0, 60)}
                </a>
              ) : (
                "None listed"
              )}
            </dd>
          </div>
          <div>
            <dt>Host</dt>
            <dd>{host}</dd>
          </div>
          <div>
            <dt>Going</dt>
            <dd>{going}</dd>
          </div>
        </dl>
        {ev.desc && <p className="door-desc">{ev.desc}</p>}
      </section>
      <section className="door-panel door-center">
        <h2 className="door-h2">Your answer</h2>
        <div className="btn-row door-actions">
          <button type="button" className="glass-btn glass-btn--primary" disabled>Going</button>
          <button type="button" className="glass-btn glass-btn--secondary" disabled>Maybe</button>
          <button type="button" className="glass-btn glass-btn--secondary" disabled>Can&apos;t go</button>
        </div>
        <SignerNote />
      </section>
    </>
  );
}
