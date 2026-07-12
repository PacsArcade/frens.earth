import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import OperatorGate from "@/components/OperatorGate";
import CertCase from "@/components/CertCase";
import AdminNav from "@/components/AdminNav";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";
import { specimenShelf } from "@/lib/certs";
import { CONSOLE_ROOMS, CONSOLE_SITE, type ConsoleRoom } from "@/lib/console";

/**
 * The admin deck — one door to every operator room. Linked from the fren
 * menu when an operator session is live; same key-is-the-operator gate as
 * every /a room. Also hosts the cert-case specimen shelf (the dressing-room
 * preview of the NES-box cert art + BFT time rarity).
 *
 * Two banks, LCARS-style: COMMAND (the rooms where the admiral rules — the
 * duty roster and the decision board) get the full-width featured cards;
 * CONNECTIONS the node rooms below. Each card wears its room's accent.
 */
export const metadata: Metadata = {
  title: "Admin deck — frens.earth",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Accent = "coin" | "neon" | "cyan" | "pink" | "ghost";
const accentOf = (cls: string): Accent =>
  (cls.match(/text-(coin|neon|cyan|pink|ghost)/)?.[1] as Accent) ?? "cyan";

const COMMAND_KEYS = ["scar", "decisions"];

export default async function AdminDeckPage() {
  const cookie = (await headers()).get("cookie");
  const operator = operatorFromCookieHeader(cookie);
  if (!operator) {
    return <OperatorGate configured={operatorsConfigured()} />;
  }
  const shelf = specimenShelf();

  // COMMAND first (in manifest order), the rest are node/connection rooms.
  const command = COMMAND_KEYS
    .map((k) => CONSOLE_ROOMS.find((r) => r.key === k))
    .filter((r): r is ConsoleRoom => Boolean(r));
  const nodes = CONSOLE_ROOMS.filter((r) => !COMMAND_KEYS.includes(r.key));

  return (
    <main className="min-h-screen console-ground">
      <AdminNav current="deck" />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="lcars-eyebrow mb-3" data-accent="cyan">
          OPERATOR CONSOLE · {CONSOLE_SITE.domain.toUpperCase()}
        </p>
        <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">ADMIN DECK</h1>
        <p className="mb-8 font-body text-sm text-white/55">
          Every operator room, one door — your key opens all of them.
        </p>

        {/* COMMAND — the rooms the admiral rules from */}
        <p className="lcars-eyebrow mb-4" data-accent="pink">
          COMMAND · RULE FROM HERE
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {command.map((r) => {
            const accent = accentOf(r.accent);
            return (
              <Link
                key={r.href}
                href={r.href}
                data-accent={accent}
                className="console-card group flex flex-col gap-3 p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="pill pill--solid">{r.label}</span>
                  <span
                    aria-hidden
                    className="font-pixel text-[10px] uppercase text-white/30 transition-colors group-hover:text-[color:var(--acc)]"
                  >
                    ENTER ▸
                  </span>
                </div>
                <p className="font-body text-sm text-white/70">{r.blurb}</p>
              </Link>
            );
          })}
        </div>

        {/* CONNECTIONS — the node rooms */}
        <p className="lcars-eyebrow mb-4 mt-10" data-accent="neon">
          CONNECTIONS · NODES &amp; DOORS
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {nodes.map((r) => {
            const accent = accentOf(r.accent);
            return (
              <Link
                key={r.href}
                href={r.href}
                data-accent={accent}
                className="console-card group flex flex-col gap-2 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="pill">{r.label}</span>
                  <span
                    aria-hidden
                    className="font-pixel text-[9px] text-white/25 transition-colors group-hover:text-[color:var(--acc)]"
                  >
                    ▸
                  </span>
                </div>
                <p className="font-body text-sm text-white/65">{r.blurb}</p>
              </Link>
            );
          })}
        </div>

        {/* Cert foundry — specimen shelf. Real BFT lore on every case; the
            profile shelf renders the same component once certs have data. */}
        <div className="mt-14">
          <p className="lcars-eyebrow mb-3" data-accent="coin">
            CERT FOUNDRY · CASE SPECIMENS
          </p>
          <p className="mb-4 max-w-2xl font-body text-sm text-white/60">
            Every cert ships as box art. The block it etched at decides the case — full moons
            mint silver, epoch boundaries mint gold (the Zelda cart), the Bitcoin new year mints
            crystal, and halvings mint the astronomical tier. No randomness: look at the block.
          </p>
          <div className="flex flex-wrap gap-4">
            {shelf.map((c) => (
              <CertCase key={c.code} cert={c} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
