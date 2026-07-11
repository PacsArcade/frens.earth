import Link from "next/link";
import { CONSOLE_ROOMS, CONSOLE_SITE } from "@/lib/console";

/**
 * The bridge rail — one compact row on every /a room: the way BACK TO THE
 * SITE first (the door the deck was missing, Pac 2026-07-11), then the deck,
 * then every room from the console manifest. Modular by construction: rooms
 * and site identity come from src/lib/console.ts, so templated sites
 * (pacsarcade-org, onecocreation) reconfigure instead of re-code.
 */
export default function AdminNav({ current }: { current: "deck" | string }) {
  return (
    <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-6 pt-6">
      {/* the exit — the site this console administers */}
      <Link
        href={CONSOLE_SITE.home}
        className="min-h-9 border-2 border-edge px-3 py-1 font-pixel text-[9px] uppercase text-neon/80 hover:border-neon/50 hover:text-neon"
      >
        ⌂ {CONSOLE_SITE.domain.toUpperCase()}
      </Link>
      <span aria-hidden className="font-pixel text-[9px] text-white/20">▸</span>
      <Link
        href="/a"
        aria-current={current === "deck" ? "page" : undefined}
        className={`min-h-9 border-2 px-3 py-1 font-pixel text-[9px] uppercase ${
          current === "deck"
            ? "border-cyan text-cyan"
            : "border-edge text-white/40 hover:border-cyan/50 hover:text-white/80"
        }`}
      >
        ⚓ DECK
      </Link>
      {CONSOLE_ROOMS.map((r) => (
        <Link
          key={r.key}
          href={r.href}
          aria-current={r.key === current ? "page" : undefined}
          className={`min-h-9 border-2 px-3 py-1 font-pixel text-[9px] uppercase ${
            r.key === current
              ? "border-cyan text-cyan"
              : "border-edge text-white/40 hover:border-cyan/50 hover:text-white/80"
          }`}
        >
          {r.label}
        </Link>
      ))}
    </nav>
  );
}
