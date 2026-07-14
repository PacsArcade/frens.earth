"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * The notification — our first one (Pac, 2026-07-11): a compact, dismissible
 * strip instead of a giant setup card. Dismissal remembers per-id on this
 * device; the notice returns if the condition persists on a new device (it
 * IS still true). Reusable for every future "the ship needs a thing" nudge.
 */
export default function Notice({ id, children }: { id: string; children: ReactNode }) {
  const key = `fe-notice-${id}`;
  const [dismissed, setDismissed] = useState(true); // start hidden — no flash
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(key) === "1");
    } catch {
      setDismissed(false);
    }
  }, [key]);
  if (dismissed) return null;
  /* cyan, not coin — a notice is INFO; gold stays money-only (house law) */
  return (
    <div className="mb-4 flex items-start gap-3 rounded-r-lg border-l-4 border-cyan bg-cyan/5 px-3 py-2">
      <p className="min-w-0 flex-1 font-body text-xs text-white/80">
        <span className="mr-2 font-pixel text-[9px] uppercase text-cyan">◈ NOTICE</span>
        {children}
      </p>
      <button
        onClick={() => {
          try {
            localStorage.setItem(key, "1");
          } catch {
            /* still dismiss for this render */
          }
          setDismissed(true);
        }}
        aria-label="Dismiss notice"
        className="flex-none rounded-md border border-edge px-1.5 py-0.5 font-pixel text-[9px] text-white/40 hover:border-cyan hover:text-white/80"
      >
        ✕
      </button>
    </div>
  );
}
