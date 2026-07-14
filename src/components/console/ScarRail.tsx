"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONSOLE_ROOMS, CONSOLE_SITE, roomForPath } from "@/lib/console";
import BftTrayClock from "./BftTrayClock";

/**
 * The ELBOW RIBBON — the LCARS signature of the SCAR·LET shell: a sticky
 * vertical rail of colour blocks that sweeps into the top bar through a big
 * concave corner. Top to bottom: the elbow itself (the leave-console door,
 * ⌂ back to the site), the SCAR·LET brand block (console front page), the
 * five rooms with the active room's accordion sub-nav nested under it, then
 * the numeric callouts — the SCAR room readout and the ONE BFT tray-clock.
 *
 * ≤900px the same markup is raised as a bottom SHEET by the ▲ MENU sweep
 * (Option B); the sheet header + ✕ only show there. Rooms and site identity
 * come from src/lib/console.ts, so templated sites reconfigure, not re-code.
 */
export default function ScarRail({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const room = roomForPath(pathname);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const readout = `${pad2(CONSOLE_ROOMS.indexOf(room) + 1)} / ${pad2(CONSOLE_ROOMS.length)}`;

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

      {/* SCAR·LET opens the console front page (the Overview room is phase 2 —
          until it exists the mark lands on the console's landing tab) */}
      <Link
        href="/a"
        className="scar-rail__brand"
        onClick={onNavigate}
        title="SCAR·LET — the console front page"
      >
        <b>SCAR·LET</b>
        <small>Console</small>
      </Link>

      <nav className="scar-rail__nav" aria-label="rooms">
        {CONSOLE_ROOMS.map((r) => {
          const active = r.key === room.key;
          return (
            <div key={r.key}>
              <Link
                href={r.href}
                data-accent={r.tone}
                aria-current={active ? "page" : undefined}
                className="scar-railbtn"
                style={{ width: "100%" }}
                onClick={onNavigate}
                title={r.blurb}
              >
                {r.short}
              </Link>
              {/* accordion — the active room's sub-sections nest under it */}
              {active && r.subs && r.subs.length > 0 && (
                <div className="scar-railsub" data-for={r.key}>
                  {r.subs.map((s) =>
                    s.soon ? (
                      <span
                        key={s.key}
                        className="scar-railsubbtn scar-railsubbtn--soon"
                        aria-disabled="true"
                      >
                        {s.label} <span className="soon">SOON</span>
                      </span>
                    ) : (
                      <Link
                        key={s.key}
                        href={s.href}
                        data-accent={r.tone}
                        className="scar-railsubbtn"
                        aria-current={s.href === pathname ? "page" : undefined}
                        onClick={onNavigate}
                      >
                        {s.label}
                      </Link>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="scar-rail__gap" />

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
