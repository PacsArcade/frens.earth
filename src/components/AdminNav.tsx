import Link from "next/link";
import { CONSOLE_ROOMS, CONSOLE_SITE } from "@/lib/console";

/**
 * The bridge rail — one LCARS-style row on every /a room: the way BACK TO THE
 * SITE as the rounded "elbow" cap first (the door the deck was missing, Pac
 * 2026-07-11), then the deck, then every room from the console manifest as a
 * colour-coded pill tab. Modular by construction: rooms and site identity come
 * from src/lib/console.ts, so templated sites (pacsarcade-org, onecocreation)
 * reconfigure instead of re-code. Each tab wears its room's own accent — the
 * accent name is read straight from the manifest's Tailwind class, so no new
 * data field is needed.
 */

type Accent = "coin" | "neon" | "cyan" | "pink" | "ghost";

/** Pull the semantic colour out of a manifest accent string ("… text-pink"). */
function accentOf(cls: string): Accent {
  const m = cls.match(/text-(coin|neon|cyan|pink|ghost)/);
  return (m?.[1] as Accent) ?? "cyan";
}

export default function AdminNav({ current }: { current: "deck" | string }) {
  const tabs: { key: string; href: string; label: string; accent: Accent }[] = [
    { key: "deck", href: "/a", label: "⚓ DECK", accent: "cyan" },
    ...CONSOLE_ROOMS.map((r) => ({
      key: r.key,
      href: r.href,
      label: r.label,
      accent: accentOf(r.accent),
    })),
  ];
  const total = tabs.length;
  const here = tabs.findIndex((t) => t.key === current);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <nav aria-label="operator console" className="lcars-rail mx-auto max-w-5xl px-6 pt-6">
      {/* the elbow cap — the exit back to the site this console administers */}
      <Link href={CONSOLE_SITE.home} className="lcars-cap">
        ⌂ {CONSOLE_SITE.domain.toUpperCase()}
      </Link>
      <div className="lcars-tabs">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            data-accent={t.accent}
            aria-current={t.key === current ? "page" : undefined}
            className="lcars-tab"
          >
            {t.label}
          </Link>
        ))}
      </div>
      {/* numeric/label block — which room, of how many (LCARS readout) */}
      <p className="lcars-readout" aria-hidden>
        <span>BRIDGE</span>
        <span className="lcars-readout__seg">
          {pad(here < 0 ? 0 : here + 1)} / {pad(total)}
        </span>
      </p>
    </nav>
  );
}
