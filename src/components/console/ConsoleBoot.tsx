"use client";

import { useEffect, useState } from "react";

/**
 * The CRT power-on — the SCAR Console v2 wake, ported from the prototype's
 * boot overlay (scar-boot-beam → scar-boot-fade): a point of light stretches
 * into a scanline, holds a beat, then blooms into the picture.
 *
 * House rules, kept:
 *   • once per SESSION (sessionStorage) — a room change never re-boots;
 *   • prefers-reduced-motion skips the wake entirely (belt: JS; braces: CSS);
 *   • the overlay is pointer-events:none and unmounts at ~1.2s, so the tube
 *     warming up never blocks the operator's hands.
 *
 * SSR renders nothing, and the client only lights the beam on an async tick
 * inside the effect, so hydration never disagrees.
 */

const BOOT_KEY = "scarlet:booted";

export default function ConsoleBoot() {
  const [lit, setLit] = useState(false);

  useEffect(() => {
    let offId: number | undefined;
    /* async tick — the decision + setState stay out of the effect body */
    const onId = window.setTimeout(() => {
      try {
        if (sessionStorage.getItem(BOOT_KEY) === "1") return;
        sessionStorage.setItem(BOOT_KEY, "1");
      } catch {
        /* private mode — the wake still plays, it just isn't remembered */
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      setLit(true);
      offId = window.setTimeout(() => setLit(false), 1200);
    }, 0);
    return () => {
      window.clearTimeout(onId);
      if (offId !== undefined) window.clearTimeout(offId);
    };
  }, []);

  if (!lit) return null;
  return (
    <div className="scar-boot" aria-hidden="true">
      <div className="scar-boot__beam" />
    </div>
  );
}
