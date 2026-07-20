"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CONSOLE_NODE,
  CONSOLE_OFFICERS,
  CONSOLE_ROOMS,
  CONSOLE_SITE,
  roomForPath,
  type ConsoleRoomSub,
} from "@/lib/console";
import { tabBleep } from "@/lib/console-fx";
import BftTrayClock from "./BftTrayClock";

/**
 * The ELBOW RIBBON — the LCARS signature of the SCAR·LET shell: a sticky
 * vertical rail of colour blocks that sweeps into the top bar through a big
 * concave corner. Top to bottom: the elbow itself (the leave-console door,
 * ⌂ back to the site), the SCAR·LET brand block (the Overview front page —
 * it lights up while you're home), the five rooms with the active room's
 * accordion sub-nav nested under it, then the numeric callouts — the SCAR
 * room readout and the ONE BFT tray-clock.
 *
 * The accordion is PROGRESSIVE: entering a room shows level 1 only; a
 * level-1 item with children opens its level-2 filter rail only when
 * clicked — never all levels at once. Sub-items with a countKey wear the
 * label-left / count-right pill (uniform min-width), fed by ONE cheap read
 * of /api/admin/counts so the rail and the boards always agree.
 *
 * ≤900px the same markup is raised as a bottom SHEET by the ▲ MENU sweep
 * (Option B); the sheet header + ✕ only show there. Rooms and site identity
 * come from src/lib/console.ts, so templated sites reconfigure, not re-code.
 */
export default function ScarRail({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const room = roomForPath(pathname);
  const isOverview = room.key === "overview";
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const readout = isOverview
    ? "◉ HOME"
    : `${pad2(CONSOLE_ROOMS.indexOf(room) + 1)} / ${pad2(CONSOLE_ROOMS.length)}`;

  /* live counts for the accordion pills — one gated read, refreshed per room
     move so a signed act updates the rail on the way out */
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/counts")
      .then((res) => res.json())
      .then((data) => {
        if (alive && data?.ok) setCounts(data.counts);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  /* PROGRESSIVE accordion — which level-1 sub has its filters open; entering
     a different room folds everything back to level 1 only */
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const [prevRoomKey, setPrevRoomKey] = useState(room.key);
  if (prevRoomKey !== room.key) {
    setPrevRoomKey(room.key);
    setExpandedSub(null);
  }

  /* the URL hash marks the active level-2 filter (the boards keep it true) */
  const [hash, setHash] = useState("");
  useEffect(() => {
    const read = () => setHash(window.location.hash);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [pathname]);

  const subLabel = (s: ConsoleRoomSub) => {
    const count = s.countKey ? counts?.[s.countKey] : undefined;
    if (count === undefined) return s.label;
    return (
      <>
        <span className="rl">{s.label}</span>
        <span className="rc">{count}</span>
      </>
    );
  };

  return (
    <aside className="scar-rail" id="scar-rail-sheet" aria-label="operator console rooms">
      {/* sheet header — only shown when the rail is raised as a bottom sheet on mobile */}
      <div className="scar-rail__sheethead">
        <span className="scar-rail__sheettitle">Rooms</span>
        <button
          type="button"
          className="scar-rail__sheetx"
          onClick={onNavigate}
          aria-label="close the rooms menu"
        >
          ✕
        </button>
      </div>

      {/* the elbow IS the leave-console button — back to the site this console administers */}
      <Link
        href={CONSOLE_SITE.home}
        className="scar-rail__elbow"
        title={`Leave the console — open ${CONSOLE_SITE.domain}`}
      >
        <span>{CONSOLE_SITE.domain}</span>
      </Link>

      {/* SCAR·LET opens the console front page — the Overview room (◉ HOME) */}
      <Link
        href="/a"
        className="scar-rail__brand"
        aria-current={isOverview ? "page" : undefined}
        onClick={onNavigate}
        title="SCAR·LET Overview — the console front page"
      >
        <b>SCAR·LET</b>
        <small>Overview</small>
      </Link>

      <nav className="scar-rail__nav" aria-label="rooms">
        {CONSOLE_ROOMS.map((r) => {
          const active = r.key === room.key;
          if (r.soon) {
            /* honest berth — the room is registered but its route hasn't
               landed; never a dead link (house law) */
            return (
              <span
                key={r.key}
                className="scar-railbtn scar-railbtn--soon"
                aria-disabled="true"
                title={r.blurb}
              >
                {r.short} <span className="soon">SOON</span>
              </span>
            );
          }
          return (
            <div key={r.key}>
              <Link
                href={r.href}
                data-accent={r.tone}
                aria-current={active ? "page" : undefined}
                className="scar-railbtn"
                style={{ width: "100%" }}
                onClick={() => {
                  /* room enter (or re-enter) → back to level 1 only */
                  setExpandedSub(null);
                  tabBleep();
                  onNavigate();
                }}
                title={r.blurb}
              >
                {r.short}
              </Link>
              {/* accordion — the active room's sub-sections nest under it */}
              {active && r.subs && r.subs.length > 0 && (
                <div className="scar-railsub" data-for={r.key}>
                  {r.subs.map((s) => {
                    if (s.soon) {
                      return (
                        <span
                          key={s.key}
                          className="scar-railsubbtn scar-railsubbtn--soon"
                          aria-disabled="true"
                        >
                          {s.label} <span className="soon">SOON</span>
                        </span>
                      );
                    }
                    const hasKids = (s.children?.length ?? 0) > 0;
                    const expanded = hasKids && expandedSub === s.key;
                    return (
                      <div key={s.key}>
                        <Link
                          href={s.href}
                          data-accent={r.tone}
                          className={`scar-railsubbtn${hasKids ? " scar-railsubbtn--parent" : ""}`}
                          style={{ width: "100%" }}
                          aria-current={s.href.split("#")[0] === pathname ? "page" : undefined}
                          aria-expanded={hasKids ? expanded : undefined}
                          onClick={() => {
                            /* progressive: clicking level 1 opens ITS level 2 */
                            setExpandedSub(hasKids ? s.key : null);
                            tabBleep();
                            if (!hasKids) onNavigate();
                          }}
                        >
                          {subLabel(s)}
                        </Link>
                        {expanded && (
                          <div className="scar-railsub2" data-for2={s.key}>
                            {s.children!.map((c) =>
                              /* level-2 filters are plain anchors — a native
                                 hash jump fires hashchange, which is how the
                                 board and this rail stay in step */
                              <a
                                key={c.key}
                                href={c.href}
                                data-accent={r.tone}
                                className="scar-railsubbtn scar-railsubbtn--2"
                                aria-current={
                                  c.href === pathname + hash ? "page" : undefined
                                }
                                onClick={() => {
                                  tabBleep();
                                  onNavigate();
                                }}
                              >
                                {subLabel(c)}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="scar-rail__gap" />

      {/* the ship-node block — the v2 sidebar's node readout, restored. The
          officers are Pac's identity ruling (display only, never auth). */}
      <div className="scar-railnode" title="this console's ship node — the name is config, not code">
        <span className="scar-railnode__name">
          <span className="scar-clockdot" aria-hidden="true" /> NODE: {CONSOLE_NODE.name}
        </span>
        {CONSOLE_OFFICERS.map((o) => (
          <span key={o.role} className="scar-railnode__line">
            {o.role} · {o.display}
          </span>
        ))}
      </div>

      {/* numeric callouts — the console's REAL data */}
      <div className="scar-railstat">
        <span>SCAR room</span>
        <b>{readout}</b>
      </div>

      {/* the ONE BFT tray-clock — desktop home is the ribbon foot */}
      <BftTrayClock variant="rail" />
    </aside>
  );
}
