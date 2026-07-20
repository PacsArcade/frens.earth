"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONSOLE_ROOMS, CONSOLE_SITE, roomForPath } from "@/lib/console";
import {
  coinBleep,
  setSoundOn,
  setStoredTheme,
  soundOn,
  storedTheme,
  tabBleep,
  THEME_ORDER,
  TWEAKS_EVENT,
} from "@/lib/console-fx";
import ScarRail from "./ScarRail";
import BftTrayClock from "./BftTrayClock";
import ConsoleBoot from "./ConsoleBoot";
import ScarHud from "./ScarHud";

/**
 * The SCAR·LET shell — the approved LCARS operator console frame around every
 * /a room (mounted by src/app/a/layout.tsx once the operator key clears).
 *
 * Desktop ≥901px: two columns — the sticky elbow RIBBON (rooms + accordion +
 * SCAR readout + the ship-node block + BFT tray-clock) beside the main column,
 * whose sticky top bar carries the breadcrumb + the v2 header controls
 * (THEME arcade↔lcars · SND on/off · the operator's rank chip) + SCAR readout.
 *
 * Mobile ≤900px (Option B): the ribbon hides into a bottom SHEET raised by
 * the ▲ MENU sweep on a persistent bottom elbow bar (current room ·
 * SCAR 0x/05 · the tray-clock); scrim / ✕ / Escape dismiss it, and the sheet
 * closes itself on every navigation. The single brand statement is the footer
 * brandline.
 *
 * The HUD (ScarHud — node · rank · points · commendations) rides the top bar
 * on every deck; it absorbed the old rank chip, so /api/admin/rank reads
 * once, in one place. ≤900px the bar wraps and the HUD takes its own line.
 *
 * The THEME seam is SCAR Console v2's, three positions deep: Pac's Arcade
 * (default) → LCARS tribute → the brand cartridge (this site's own
 * BrandTheme tokens — NIGHT GARDEN). Each is a token-level remap via
 * data-console-theme, never a markup fork; the key-resolved home-space
 * cartridge (docs/brand-cartridge.md) is the honest SOON on the seam.
 */

const THEME_LABEL = { arcade: "ARCADE", lcars: "LCARS", cartridge: "CARTRIDGE" } as const;

export default function ConsoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  /* v2 header tweaks — localStorage is the external store; the server
     snapshot renders the defaults (arcade, snd off) so hydration never
     disagrees, then the client snapshot takes over after mount */
  const subscribeTweaks = useCallback((onChange: () => void) => {
    window.addEventListener(TWEAKS_EVENT, onChange);
    return () => window.removeEventListener(TWEAKS_EVENT, onChange);
  }, []);
  const theme = useSyncExternalStore(subscribeTweaks, storedTheme, () => "arcade" as const);
  const snd = useSyncExternalStore(subscribeTweaks, soundOn, () => false);

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
    <div className="console-ground min-h-screen" data-console-theme={theme}>
      {/* the CRT wake — once per session, never blocking (v2 boot sequence) */}
      <ConsoleBoot />
      <div className="scar-frame">
        <ScarRail onNavigate={closeMenu} />

        <div className="scar-main">
          {/* the LCARS top bar — breadcrumb on desktop, ⌂ site-exit on mobile,
              plus the v2 header controls (theme · sound · rank) */}
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

              {/* the HUD — node · rank · points · commendations, every deck
                  (it absorbed the old rank chip; one gated read inside) */}
              <ScarHud />

              <div className="scar-tweaks" role="group" aria-label="console tweaks">
                <button
                  type="button"
                  className="scar-tweak"
                  onClick={() => {
                    const next =
                      THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
                    setStoredTheme(next);
                    tabBleep();
                  }}
                  title="theme — Pac's Arcade → LCARS tribute → the brand cartridge (frens.earth NIGHT GARDEN token remap; your key-resolved home-space cartridge lands SOON)"
                >
                  THEME: {THEME_LABEL[theme]}
                </button>
                <button
                  type="button"
                  className="scar-tweak"
                  aria-pressed={snd}
                  onClick={() => {
                    const next = !snd;
                    setSoundOn(next);
                    if (next) coinBleep(true);
                  }}
                  title="console bleeps — off by default, your call always"
                >
                  SND: {snd ? "ON" : "OFF"}
                </button>
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
