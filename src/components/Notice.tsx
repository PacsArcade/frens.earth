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
  return (
    <div className="mb-4 flex items-start gap-3 border-l-4 border-coin bg-coin/5 px-3 py-2">
      <p className="min-w-0 flex-1 font-body text-xs text-white/80">
        <span className="mr-2 font-pixel text-[9px] uppercase text-coin">◈ NOTICE</span>
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
        className="flex-none border border-edge px-1.5 font-pixel text-[9px] text-white/40 hover:text-white/80"
      >
        ✕
      </button>
    </div>
  );
}
