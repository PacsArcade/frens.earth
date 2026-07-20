import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import OperatorGate from "@/components/OperatorGate";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";
import { CONSOLE_SITE } from "@/lib/console";
import { effectiveMudNode } from "@/lib/nodeconfig";

/**
 * SIMULATOR — deck 03 of the SCAR Console v2 layout. The SIM DECK is the
 * P.O.K.E. MUD's berth: POKEMUD is built into the pokenode (knowledge-engine),
 * so the deck here is the DOOR to that node — play money only, nothing on
 * this deck can spend real sats. The v2 battle terminal (KHA0S creep, SCAN /
 * PATCH / PURGE, reactor heat) runs ON the node, not in this console — when
 * no node is linked the deck says so honestly instead of simulating one.
 * TRAINING MODULES is an honest SOON berth until the node's /modules CRUD is
 * real (a stub table would be a fake shelf — house law).
 * Same key-is-the-operator gate as every /a tab.
 */
export const metadata: Metadata = {
  title: "Simulator — frens.earth admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminSimulatorPage() {
  const cookie = (await headers()).get("cookie");
  const operator = operatorFromCookieHeader(cookie);
  if (!operator) {
    return <OperatorGate configured={operatorsConfigured()} />;
  }
  const { url: mudUrl } = await effectiveMudNode();
  const linked = mudUrl.length > 0;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 pb-4 pt-10">
        <p className="lcars-eyebrow mb-3" data-accent="neon">
          OPERATOR CONSOLE · {CONSOLE_SITE.domain.toUpperCase()} · DECK 03
        </p>
        <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">SIMULATOR</h1>
        <p className="font-body text-sm text-white/55">
          The sim runs on <b className="text-white/75">play money</b> — swing hard, break things.
          Nothing on this deck can spend real sats.
        </p>
      </div>

      {/* ── SIM DECK — the door to the P.O.K.E. MUD node ─────────────────── */}
      <section id="deck" className="mx-auto max-w-5xl scroll-mt-20 px-6 pt-6">
        <p className="lcars-eyebrow mb-3" data-accent="neon">
          SIM DECK · POKEMUD IS BUILT INTO THE POKENODE
        </p>
        <div className="max-w-2xl">
          {linked ? (
            <div className="console-card p-5" data-accent="neon">
              <span className="pill" data-accent="neon">
                NODE LINKED
              </span>
              <p className="mt-3 font-body text-sm text-white/70">
                This deck fronts your own P.O.K.E. MUD node — the battle terminal, the KHA0S
                sims, and the traces-of-fun telemetry all run there, on its own metal.
              </p>
              <p className="mt-2 break-all font-mono text-[11px] text-cyan">{mudUrl}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={mudUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-pill btn-pill--solid"
                  data-accent="neon"
                >
                  ▶ Open the sim node
                </a>
                <Link href="/a/connections#mud" className="btn-pill" data-accent="cyan">
                  Tune the link
                </Link>
              </div>
            </div>
          ) : (
            /* honest empty state — no invented battle terminal */
            <div className="console-card p-5" data-accent="neon">
              <span className="pill pill--muted">NO SIM NODE LINKED</span>
              <p className="mt-3 font-body text-sm text-white/70">
                The sim deck fronts a P.O.K.E. MUD node (knowledge-engine) — this console never
                fakes the battle terminal. Wire your node on the Fleet Map and this deck lights
                up with the real thing.
              </p>
              <div className="mt-4">
                <Link href="/a/connections#mud" className="btn-pill" data-accent="cyan">
                  Wire the MUD node on the Fleet Map
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── TRAINING MODULES — honest SOON berth ─────────────────────────── */}
      <section id="modules" className="mx-auto max-w-5xl scroll-mt-20 px-6 py-10">
        <p className="lcars-eyebrow mb-3" data-accent="cyan">
          TRAINING MODULES · LVL — MODULE — PATH — ACCESS — CERT RUNE
        </p>
        <div className="max-w-2xl">
          <div className="console-card p-5" data-accent="cyan">
            <span className="pill pill--muted">SOON</span>
            <p className="mt-3 font-body text-sm text-white/70">
              The module table (levels, topic paths, VERSE•PREFIX•CODE cert runes, the
              Architect&apos;s proposed slots) lands when the node&apos;s <code>/modules</code>{" "}
              door is real — today it&apos;s a stub, and a stub table would be a fake shelf.
              This berth is cut and waiting for its wiring.
            </p>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-white/40">
              Gated modules are pacBOT understanding-checks — free, never paid.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
