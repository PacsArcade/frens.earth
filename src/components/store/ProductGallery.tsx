"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function Arrow({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === "prev" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

const ROUND_BTN =
  "glass-btn !min-h-0 !p-0 h-11 w-11 shrink-0 touch-manipulation";

function Thumbs({ shots, title, index, onPick }: { shots: string[]; title: string; index: number; onPick: (i: number) => void }) {
  if (shots.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-2 p-2" aria-label={`${title} photos`}>
      {shots.map((url, i) => (
        <li key={`${url}:${i}`}>
          <button
            type="button"
            onClick={() => onPick(i)}
            aria-current={i === index ? "true" : undefined}
            aria-label={`show photo ${i + 1} of ${shots.length}`}
            className={`block h-16 w-16 touch-manipulation overflow-hidden rounded-md border-2 bg-void sm:h-20 sm:w-20 ${
              i === index ? "border-cyan shadow-[0_0_0_2px_rgba(83,224,212,0.35)]" : "border-edge opacity-70 hover:opacity-100"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-contain" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Product photos: one big picture, arrows on its sides (they wrap), a row of
 * thumbnails, left and right keys, swipe on touch. Click the big picture and
 * it opens in a glass pane with the same controls.
 */
export default function ProductGallery({ shots, title }: { shots: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const n = shots.length;

  const go = useCallback((d: number) => setIndex((i) => (i + d + n) % n), [n]);

  const onKey = (e: React.KeyboardEvent) => {
    if (n < 2) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    }
  };
  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null || n < 2) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  };

  // the modal: lock the page scroll, Esc closes, focus goes in and comes back
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    const back = opener.current;
    const onDoc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onDoc);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onDoc);
      back?.focus();
    };
  }, [open]);

  // keep Tab inside the dialog
  const trap = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onKey(e);
    if (e.key !== "Tab") return;
    const f = e.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled)");
    if (f.length === 0) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (n === 0) return null;
  const many = n > 1;

  return (
    <div className="mt-5 overflow-hidden rounded-md border border-edge bg-panel" onKeyDown={onKey}>
      <div className="relative" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <button
          ref={opener}
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`${title}, photo ${index + 1} of ${n}. Open larger`}
          aria-haspopup="dialog"
          className="block w-full cursor-zoom-in touch-manipulation"
        >
          {/* product shots come from blob/dev-file URLs — plain img, width-bounded so nothing breaks the column */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shots[index]} alt={`${title}, photo ${index + 1}`} className="aspect-square w-full max-w-full bg-void object-contain p-6" />
        </button>
        {many && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="previous photo" className={`${ROUND_BTN} absolute left-2 top-1/2 -translate-y-1/2`}>
              <Arrow dir="prev" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="next photo" className={`${ROUND_BTN} absolute right-2 top-1/2 -translate-y-1/2`}>
              <Arrow dir="next" />
            </button>
          </>
        )}
      </div>
      <div className="border-t border-edge">
        <Thumbs shots={shots} title={title} index={index} onPick={setIndex} />
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
          style={{ background: "rgba(3,6,14,0.62)", WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${title} photos`}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={trap}
            className="relative flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/20"
            style={{
              background: "linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.05))",
              WebkitBackdropFilter: "blur(24px) saturate(1.4)",
              backdropFilter: "blur(24px) saturate(1.4)",
              boxShadow: "0 24px 80px -20px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            <div className="flex items-center justify-between gap-3 px-4 pt-3">
              <p className="min-w-0 truncate text-sm font-bold text-white">{title}</p>
              <p className="shrink-0 text-xs text-white/70" aria-live="polite">{index + 1} / {n}</p>
              <button ref={closeBtn} type="button" onClick={() => setOpen(false)} aria-label="close" className={ROUND_BTN}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="relative min-h-0 flex-1" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shots[index]} alt={`${title}, photo ${index + 1}`} className="mx-auto block max-h-[62vh] w-full object-contain p-4 sm:p-6" />
              {many && (
                <>
                  <button type="button" onClick={() => go(-1)} aria-label="previous photo" className={`${ROUND_BTN} absolute left-2 top-1/2 -translate-y-1/2`}>
                    <Arrow dir="prev" />
                  </button>
                  <button type="button" onClick={() => go(1)} aria-label="next photo" className={`${ROUND_BTN} absolute right-2 top-1/2 -translate-y-1/2`}>
                    <Arrow dir="next" />
                  </button>
                </>
              )}
            </div>
            <div className="overflow-y-auto border-t border-white/15">
              <Thumbs shots={shots} title={title} index={index} onPick={setIndex} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
