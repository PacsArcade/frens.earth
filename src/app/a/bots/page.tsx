import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import OperatorGate from "@/components/OperatorGate";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";
import { CONSOLE_SITE } from "@/lib/console";

/**
 * BOT DECK — deck 04 of the SCAR Console v2 layout: the four owner-toggled
 * add-ons, each in its berth. The bot swarm runs ON the P.O.K.E. MUD node
 * (knowledge-engine), not in this console, and none of it is wired to this
 * deployment yet — so every card is an HONEST OFF berth (house law: no fake
 * toggles, no invented telemetry). The one real door is the Fleet Map's MUD
 * section, where the node that carries the swarm gets linked.
 * Same key-is-the-operator gate as every /a tab.
 */
export const metadata: Metadata = {
  title: "Bot deck — frens.earth admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const BOTS: {
  name: string;
  role: string;
  desc: string;
  accent: "pink" | "neon" | "cyan";
}[] = [
  {
    name: "PACBOT",
    role: "OPS BOT · TUTOR",
    desc: "May read stats/events and act on your behalf. Runs the understanding-checks that gate training modules — free, never paid.",
    accent: "pink",
  },
  {
    name: "POKE-ENGINEER",
    role: "CHIEF ENGINEER · AUDITS",
    desc: "Audits the node on a cadence — configs, caps, cert chains — and opens tickets only when something's really wrong.",
    accent: "neon",
  },
  {
    name: "POKE-COUNSEL",
    role: "SHIP'S COUNSEL · COMPLIANCE",
    desc: "Watches copy and chat for banned verbiage and compliance slips. Education, never advice.",
    accent: "cyan",
  },
  {
    name: "ARCHITECT",
    role: "ORGANISATION · NAMING",
    desc: "Owns level ladders, topic paths and the VERSE•PREFIX•CODE rune pattern. Proposes — the operator stays the editor.",
    accent: "pink",
  },
];

/* static map — Tailwind needs literal class names to generate */
const NAME_TINT: Record<string, string> = {
  pink: "text-pink",
  neon: "text-neon",
  cyan: "text-cyan",
};

export default async function AdminBotDeckPage() {
  const cookie = (await headers()).get("cookie");
  const operator = operatorFromCookieHeader(cookie);
  if (!operator) {
    return <OperatorGate configured={operatorsConfigured()} />;
  }
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 pb-4 pt-10">
        <p className="lcars-eyebrow mb-3" data-accent="cyan">
          OPERATOR CONSOLE · {CONSOLE_SITE.domain.toUpperCase()} · DECK 04
        </p>
        <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">BOT DECK</h1>
        <p className="max-w-2xl font-body text-sm text-white/55">
          Owner-toggled add-ons. Bots may read stats/events and act on your behalf —{" "}
          <b className="text-white/75">OFF by default, your call always</b>.
        </p>
      </div>

      <div className="mx-auto max-w-5xl px-6 pb-6 pt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {BOTS.map((b) => (
            <div key={b.name} className="console-card p-5" data-accent={b.accent}>
              <div className="flex items-center justify-between gap-3">
                <span className={`font-arcade text-xl ${NAME_TINT[b.accent]}`}>{b.name}</span>
                <span className="pill pill--muted">OFF — NOT WIRED</span>
              </div>
              <p className="mt-1.5 font-pixel text-[10px] uppercase tracking-widest text-white/40">
                {b.role}
              </p>
              <p className="mt-2 font-body text-sm text-white/60">{b.desc}</p>
              {/* honest berth — the toggle exists on the node, not here yet */}
              <span
                className="btn-pill btn-pill--muted mt-4 opacity-45"
                aria-disabled="true"
                title="the toggle rides the node link — wiring SOON"
              >
                TOGGLE — SOON
              </span>
            </div>
          ))}
        </div>

        <div className="console-card mt-6 max-w-2xl p-5" data-accent="cyan">
          <p className="font-body text-sm text-white/70">
            The bot swarm rides the P.O.K.E. MUD node, not this console — these berths light up
            (real toggles, real telemetry, Admiral-gated sliders) once that node is linked and
            its bot doors are opened. No node, no pretend switches.
          </p>
          <div className="mt-4">
            <Link href="/a/connections#mud" className="btn-pill" data-accent="cyan">
              Wire the MUD node on the Fleet Map
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
