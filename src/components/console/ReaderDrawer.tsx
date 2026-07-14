"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The READER DRAWER — the SCAR·LET right-side detail reader, shared by every
 * room that pairs a board with a reader (sign-offs, status reports, briefs).
 *
 * CLOSED BY DEFAULT: with no reader the grid is a single column and the board
 * fills the width. Selecting an item opens the drawer TOP-ALIGNED beside the
 * board (sticky under the top bar); ⤢ EXPAND fills the board area with the
 * reader (the elbow ribbon stays put) and flips to ↙ BACK TO LIST; ✕ (or
 * Escape) closes it. ≤900px the drawer is static in the single column and
 * scrolls itself into view on open.
 */

export interface ReaderContent {
  /** semantic accent — the colour law holds (never coin: gold = money only) */
  accent: "neon" | "cyan" | "pink" | "ghost";
  /** the code line, top-left (e.g. "SEC-0001 · CROSS-CUTTING") */
  code: string;
  title: string;
  /** pill row under the code */
  chips?: ReactNode;
  /** meta line under the title (raised-by · stamps) */
  meta?: ReactNode;
  /** the reader body */
  body: ReactNode;
}

export function ScarConsole({
  reader,
  onClose,
  children,
}: {
  reader: ReaderContent | null;
  onClose: () => void;
  children: ReactNode;
}) {
  const [full, setFull] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);

  /* leaving the reader also leaves expand-full — next open starts split */
  const open = reader !== null;
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setFull(false);
  }

  /* a fresh item starts read from the top; on a phone (static drawer below
     the board) bring the reader into view so the open is visible */
  const code = reader?.code;
  useEffect(() => {
    if (!code) return;
    scrollRef.current?.scrollTo({ top: 0 });
    if (window.matchMedia("(max-width: 900px)").matches) {
      drawerRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [code]);

  /* Escape = ✕ (the mobile rooms-sheet has its own Escape; it stops there
     only while the sheet is up, which also means no reader is in focus) */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.body.classList.contains("menu-open")) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={`scar-console${open ? (full ? " scar-console--full" : " scar-console--open") : ""}`}
    >
      <section className="scar-console__board">{children}</section>
      {reader && (
        <aside
          ref={drawerRef}
          className="scar-drawer"
          data-accent={reader.accent}
          aria-label="reader"
          aria-live="polite"
        >
          <div className="scar-drawer__bar" aria-hidden="true" />
          <div className="scar-drawer__head">
            <p className="scar-drawer__code">{reader.code}</p>
            <div className="scar-drawer__actions">
              <button
                type="button"
                className="scar-drawer__expand"
                onClick={() => setFull((f) => !f)}
                aria-pressed={full}
              >
                <span aria-hidden="true">{full ? "↙" : "⤢"}</span>
                {full ? "Back to list" : "Expand"}
              </button>
              <button
                type="button"
                className="scar-drawer__x"
                onClick={onClose}
                aria-label="close the reader"
              >
                ✕
              </button>
            </div>
          </div>
          <div ref={scrollRef} className="scar-drawer__scroll">
            {reader.chips && (
              <div className="mb-2 flex flex-wrap items-center gap-2">{reader.chips}</div>
            )}
            <h2 className="font-pixel text-base uppercase leading-snug text-white/90">
              {reader.title}
            </h2>
            {reader.meta && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10.5px] text-white/40">
                {reader.meta}
              </div>
            )}
            <div className="mt-3">{reader.body}</div>
          </div>
        </aside>
      )}
    </div>
  );
}
