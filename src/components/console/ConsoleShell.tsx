"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONSOLE_ROOMS, CONSOLE_SITE, roomForPath } from "@/lib/console";
import ScarRail from "./ScarRail";
import BftTrayClock from "./BftTrayClock";

/**
 * The SCAR·LET shell — the approved LCARS operator console frame around every
 * /a room (mounted by src/app/a/layout.tsx once the operator key clears).
 *
 * Desktop ≥901px: two columns — the sticky elbow RIBBON (rooms + accordion +
 * SCAR readout + BFT tray-clock) beside the main column, whose sticky top bar
 * carries the breadcrumb + SCAR readout.
 *
 * Mobile ≤900px (Option B): the ribbon hides into a bottom SHEET raised by
 * the ▲ MENU sweep on a persistent bottom elbow bar (current room ·
 * SCAR 0x/05 · the tray-clock); scrim / ✕ / Escape dismiss it, and the sheet
 * closes itself on every navigation. Route changes land at the top of the
 * page (Next's default scroll behaviour — anchors still scroll to their
 * section). The single brand statement is the footer brandline.
 */
export default function ConsoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const room = roomForPath(pathname);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  /* the Overview front page isn't a numbered room — the readout reads HOME */
  const readout =
    room.key === "overview"
      ? "◉ HOME"
      : `${pad2(CONSOLE_ROOMS.indexOf(room) + 1)} / ${pad2(CONSOLE_ROOMS.length)}`;

  /* the sheet state lives on <body> so the CSS (scrim, caret flip, scroll
     lock, sheet raise) follows one class, same as the approved wireframe */
  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [menuOpen]);

  /* dismiss via Escape; drop the sheet if the viewport grows past the bar */
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const wide = window.matchMedia("(min-width: 901px)");
    const onWide = () => wide.matches && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [menuOpen]);

  /* every nav switch closes the sheet (belt to the onNavigate braces) —
     the adjust-state-during-render pattern, no effect needed */
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setMenuOpen(false);
  }

  return (
    <div className="console-ground min-h-screen">
      <div className="scar-frame">
        <ScarRail onNavigate={closeMenu} />

        <div className="scar-main">
          {/* the LCARS top bar — breadcrumb on desktop, ⌂ site-exit on mobile */}
          <header className="scar-topbar">
            <div className="scar-topbar__row">
              <Link
                href={CONSOLE_SITE.home}
                className="scar-siteexit"
                title={`Leave the console — open ${CONSOLE_SITE.domain}`}
              >
                <span aria-hidden="true">⌂</span> {CONSOLE_SITE.domain}
              </Link>
              <div className="scar-crumb">
                <span className="scar-crumb__site">{CONSOLE_SITE.domain}</span>
                <span className="scar-crumb__sep" aria-hidden="true">
                  ›
                </span>
                <span className="scar-crumb__room">{room.label}</span>
              </div>
              <p className="scar-readout" aria-hidden="true">
                <span>SCAR</span>
                <b>{readout}</b>
              </p>
            </div>
          </header>

          {children}

          {/* the ONE brand statement — footer brandline only */}
          <p className="scar-brandline">
            <b>SCAR·LET</b> — <b>Sovereign Corps Access Relay</b> ·{" "}
            <b>Ledger Etched Time</b> — the operator console.
          </p>
        </div>
      </div>

      {/* ── Option B mobile chrome: scrim + persistent bottom elbow bar ───── */}
      <div className="scar-scrim" aria-hidden="true" onClick={closeMenu} />
      <nav className="scar-mbar" aria-label="rooms & time">
        <button
          type="button"
          className="scar-mbar__menu"
          aria-expanded={menuOpen}
          aria-controls="scar-rail-sheet"
          aria-label={menuOpen ? "close the rooms menu" : "open the rooms menu"}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="scar-mbar__caret" aria-hidden="true">
            ▲
          </span>
          <span className="scar-mbar__menulbl" aria-hidden="true">
            {menuOpen ? "CLOSE" : "MENU"}
          </span>
        </button>
        <div className="scar-mbar__room">
          <span className="scar-mbar__roomname">{room.label}</span>
          <span className="scar-mbar__readout">
            SCAR <b>{readout}</b>
          </span>
        </div>
        {/* the ONE BFT tray-clock — mobile home is the bottom bar */}
        <BftTrayClock variant="bar" />
      </nav>
    </div>
  );
}
