"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DOORS } from "@/lib/doors/config";
import { dedupeAddressable, useNames, useRelayEvents, useTip, withAllow } from "@/lib/doors/useDoors";
import { BLOCKS_PER_DAY, BLOCKS_PER_MONTH, bftStamp, heightFor, monthStartOf, oldDate, shortNpub } from "@/lib/doors/format";
import { parseCal, type CalEvent, type EventType } from "@/lib/doors/parse";
import { bft } from "@/lib/bb/bft";
import { Empty, Loading } from "./States";

const FILTERS: { key: "all" | EventType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "meetup", label: "Meetups" },
  { key: "class", label: "Classes" },
  { key: "room", label: "Rooms" },
];
const BADGE: Record<EventType, string> = { meetup: "M", class: "C", room: "R" };
const TYPE_NAME: Record<EventType, string> = { meetup: "Meetup", class: "Class", room: "Room" };

export default function CalendarView() {
  const { events, state } = useRelayEvents(
    () => [withAllow({ kinds: [31922, 31923], limit: 300 }, DOORS.calendar)],
    [],
  );
  const tip = useTip();
  const [filter, setFilter] = useState<"all" | EventType>("all");
  const [offset, setOffset] = useState(0);

  const cal = useMemo(
    () =>
      dedupeAddressable(events)
        .map(parseCal)
        .filter((e): e is CalEvent => !!e)
        .sort((a, b) => a.startMs - b.startMs),
    [events],
  );
  const names = useNames(cal.map((e) => e.pubkey));

  if (state === "loading" || !tip.ready) return <Loading what="events" />;
  if (cal.length === 0)
    return (
      <Empty
        head="Nothing published yet."
        text="Events anyone with a key can publish will show here. When one lands on the relays we read, it appears on this page with its Bitcoin date first."
      />
    );

  const tipH = tip.height;
  const stampOf = (e: CalEvent) => bftStamp(e.startMs, tipH, tip.at, !e.allDay);
  const nowH = heightFor(tip.at, tipH, tip.at);
  const monthStart = monthStartOf(nowH) + offset * BLOCKS_PER_MONTH;
  const label = bft(Math.max(0, monthStart));
  const dayOf = (ms: number) => Math.floor((heightFor(ms, tipH, tip.at) - monthStart) / BLOCKS_PER_DAY);
  const shown = cal.filter((e) => filter === "all" || e.type === filter);
  const inMonth = shown.filter((e) => {
    const d = dayOf(e.startMs);
    return d >= 0 && d < 28;
  });
  const byDay = new Map<number, CalEvent[]>();
  for (const e of inMonth) {
    const d = dayOf(e.startMs);
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }
  const todayIdx = Math.floor((nowH - monthStart) / BLOCKS_PER_DAY);
  const dayMs = (i: number) => tip.at + (monthStart + i * BLOCKS_PER_DAY - nowH) * 600_000;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <>
      <div className="door-bar">
        <div className="btn-row door-bar__group" role="group" aria-label="Event type">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className="glass-btn glass-btn--secondary"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="door-cal">
        <section className="door-panel door-month" aria-label="Month">
          <div className="door-month__head">
            <h2 className="door-h2">
              {pad(label.year).padStart(4, "0")}.{pad(label.month)} <span aria-hidden>·</span> Month {label.month}
            </h2>
            <div className="btn-row door-month__nav">
              <button type="button" className="glass-btn glass-btn--secondary" onClick={() => setOffset(offset - 1)}>
                Back
              </button>
              <button type="button" className="glass-btn glass-btn--secondary" onClick={() => setOffset(offset + 1)}>
                Next
              </button>
            </div>
          </div>
          <div className="door-grid">
            {Array.from({ length: 28 }, (_, i) => {
              const evs = byDay.get(i) ?? [];
              return (
                <div key={i} className={`door-cell${i === todayIdx ? " door-cell--today" : ""}`}>
                  <span className="door-cell__n">{pad(i + 1)}</span>
                  <span className="door-cell__old">{new Date(dayMs(i)).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  {i === todayIdx && <span className="door-cell__today">Today</span>}
                  {evs.slice(0, 2).map((e) => (
                    <Link key={e.id} href={`/calendar/${e.id}`} className="door-pill" title={e.title}>
                      <b>{BADGE[e.type]}</b>
                      <span>{e.title}</span>
                    </Link>
                  ))}
                  {evs.length > 2 && <span className="door-more">+{evs.length - 2}</span>}
                </div>
              );
            })}
          </div>
          <p className="door-fine">
            M meetup, C class, R room. Every Bitcoin month is exactly 28 days. Old dates are small print and approximate.
          </p>
        </section>

        <section className="door-panel door-list" aria-label="Events this month">
          <h2 className="door-h2">This month</h2>
          {inMonth.length === 0 ? (
            <p className="door-state__text">
              No {filter === "all" ? "" : `${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} `}events in this month. Try Back or Next.
            </p>
          ) : (
            <ul className="door-rows">
              {inMonth.map((e) => (
                <li key={e.id}>
                  <Link href={`/calendar/${e.id}`} className="door-ev">
                    <span className="door-ev__day">{pad(dayOf(e.startMs) + 1)}</span>
                    <span className="door-ev__body">
                      <span className="door-ev__title">{e.title}</span>
                      <span className="door-ev__meta">
                        {stampOf(e)} a₿{e.place ? ` · ${e.place}` : ""}
                      </span>
                      <span className="door-ev__old">{oldDate(e.startMs)}</span>
                      <span className="door-chips">
                        <span className="door-chip">{TYPE_NAME[e.type]}</span>
                        {e.roomLink && <span className="door-chip">Online room</span>}
                        <span className="door-chip">{names[e.pubkey] ?? shortNpub(e.pubkey)}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
