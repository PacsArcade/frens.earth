import Link from "next/link";

/**
 * The bridge rail — one compact row on every /a room so the admiral can
 * always get back to the deck and hop rooms without the browser back button
 * (the lost-in-the-admin lesson, Pac 2026-07-11).
 */
const ROOMS = [
  { href: "/a", key: "deck", label: "⚓ DECK" },
  { href: "/a/scar", key: "scar", label: "SCAR" },
  { href: "/a/spaces", key: "spaces", label: "SPACES" },
  { href: "/a/mud", key: "mud", label: "MUD" },
  { href: "/a/brand", key: "brand", label: "BRAND" },
] as const;

export default function AdminNav({ current }: { current: (typeof ROOMS)[number]["key"] }) {
  return (
    <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-6 pt-6">
      {ROOMS.map((r) => (
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
