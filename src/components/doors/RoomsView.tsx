"use client";

import Link from "next/link";
import { DOORS } from "@/lib/doors/config";
import { dedupeAddressable, useNames, useNowMs, useRelayEvents, useTip, withAllow } from "@/lib/doors/useDoors";
import { bftStamp, oldDate, shortNpub, sourceChip } from "@/lib/doors/format";
import { parseCal, parseRoom, type CalEvent, type LiveRoom } from "@/lib/doors/parse";
import { Empty, Loading } from "./States";

function JoinButton({ link }: { link?: string }) {
  return link ? (
    <a href={link} target="_blank" rel="noopener noreferrer" className="glass-btn glass-btn--primary">
      Join
    </a>
  ) : (
    <span className="door-fine">No room link published.</span>
  );
}

export default function RoomsView() {
  const { events, state } = useRelayEvents(
    () => [
      withAllow({ kinds: [30311], limit: 200 }, DOORS.rooms),
      withAllow({ kinds: [31923], "#t": [...new Set(["room", "rooms", ...DOORS.rooms.tags])], limit: 200 }, { authors: DOORS.rooms.authors, tags: [] }),
    ],
    [],
  );
  const tip = useTip();
  const now = useNowMs();
  const deduped = dedupeAddressable(events);
  const rooms = deduped.map(parseRoom).filter((r): r is LiveRoom => !!r);
  const live = rooms.filter((r) => r.status === "live");
  const planned = rooms.filter((r) => r.status === "planned");
  const sched = deduped
    .map(parseCal)
    .filter((e): e is CalEvent => !!e && e.type === "room" && e.startMs >= now - 3600_000)
    .sort((a, b) => a.startMs - b.startMs);
  const names = useNames([...rooms.map((r) => r.pubkey), ...sched.map((e) => e.pubkey)]);

  if (state === "loading" || !tip.ready) return <Loading what="rooms" />;
  if (live.length + planned.length + sched.length === 0)
    return (
      <Empty
        head="Nothing published yet."
        text="Rooms anyone with a key can open will show here, live or on the calendar. Join opens the room in its own tab."
      />
    );

  return (
    <>
      <section aria-label="Live rooms">
        <h2 className="door-h2 door-h2--section">Live rooms</h2>
        {live.length === 0 ? (
          <p className="door-state__text">No live rooms right now.</p>
        ) : (
          <ul className="door-cards">
            {live.map((r) => (
              <li key={r.id} className="door-panel door-card">
                <div className="door-card__top">
                  <span className="door-chip door-chip--live">Live</span>
                  <span className="door-chip">{sourceChip(r.link)}</span>
                </div>
                <h3 className="door-card__title">{r.title}</h3>
                <p className="door-card__text">{r.summary || `Hosted by ${names[r.pubkey] ?? shortNpub(r.pubkey)}.`}</p>
                <p className="door-fine">{r.listeners ? `${r.listeners} listening` : "Listener count not published"}</p>
                <div className="door-card__act"><JoinButton link={r.link} /></div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-label="Scheduled rooms">
        <h2 className="door-h2 door-h2--section">Scheduled rooms</h2>
        {planned.length + sched.length === 0 ? (
          <p className="door-state__text">Nothing scheduled yet.</p>
        ) : (
          <ul className="door-cards">
            {planned.map((r) => (
              <li key={r.id} className="door-panel door-card">
                <p className="door-stamp door-stamp--sm">
                  {r.startMs ? `${bftStamp(r.startMs, tip.height, tip.at)} a₿` : "Time not published"}
                </p>
                <div className="door-card__top"><span className="door-chip">{sourceChip(r.link)}</span></div>
                <h3 className="door-card__title">{r.title}</h3>
                <p className="door-card__text">{r.summary || `Hosted by ${names[r.pubkey] ?? shortNpub(r.pubkey)}.`}</p>
                {r.startMs && <p className="door-ev__old">{oldDate(r.startMs, true)}</p>}
                <div className="door-card__act"><JoinButton link={r.link} /></div>
              </li>
            ))}
            {sched.map((e) => (
              <li key={e.id} className="door-panel door-card">
                <p className="door-stamp door-stamp--sm">{bftStamp(e.startMs, tip.height, tip.at, !e.allDay)} a₿</p>
                <div className="door-card__top"><span className="door-chip">{sourceChip(e.roomLink)}</span></div>
                <h3 className="door-card__title">{e.title}</h3>
                <p className="door-card__text">Hosted by {names[e.pubkey] ?? shortNpub(e.pubkey)}.</p>
                <p className="door-ev__old">{oldDate(e.startMs, !e.allDay)}</p>
                <div className="btn-row door-card__act door-card__act--two">
                  <JoinButton link={e.roomLink} />
                  <Link href={`/calendar/${e.id}`} className="glass-btn glass-btn--secondary">Event</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
