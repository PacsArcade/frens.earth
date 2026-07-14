import type { Metadata } from "next";
import { headers } from "next/headers";
import OperatorGate from "@/components/OperatorGate";
import SpacesPanel from "@/components/SpacesPanel";
import ChatPanel from "@/components/ChatPanel";
import MudPanel from "@/components/MudPanel";
import MempoolPanel from "@/components/MempoolPanel";
import BriefsConnectPanel from "@/components/BriefsConnectPanel";
import DeployPanel from "@/components/DeployPanel";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";
import { CONSOLE_SITE } from "@/lib/console";
import { SPACE_NAME } from "@/lib/identity-config";

/**
 * CONNECTIONS — every node & door this deployment owns, one tab. The old
 * per-room pages (Spaces / Chat / MUD / Chain) are now stacked sections here,
 * each panel untouched (its own POINT · SAVE · TEST rail, its own gating), with
 * Torrents parked as a coming-soon berth. A jump rail skips between them. Same
 * key-is-the-operator gate as every /a tab.
 */
export const metadata: Metadata = {
  title: "Connections — frens.earth admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const SECTIONS: { id: string; label: string }[] = [
  { id: "spaces", label: "SPACES" },
  { id: "chat", label: "CHAT" },
  { id: "mud", label: "MUD" },
  { id: "chain", label: "CHAIN" },
  { id: "briefs", label: "BRIEFS" },
  { id: "deploy", label: "SHIP" },
  { id: "torrents", label: "TORRENTS" },
];

export default async function AdminConnectionsPage() {
  const cookie = (await headers()).get("cookie");
  const operator = operatorFromCookieHeader(cookie);
  if (!operator) {
    return <OperatorGate configured={operatorsConfigured()} />;
  }
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 pb-2 pt-10">
        <p className="lcars-eyebrow mb-3" data-accent="cyan">
          OPERATOR CONSOLE · {CONSOLE_SITE.domain.toUpperCase()}
        </p>
        <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">CONNECTIONS</h1>
        <p className="mb-5 font-body text-sm text-white/55">
          Your nodes and doors — point each one at your own server, save, and test. Leave one
          empty and it falls back honestly.
        </p>
        {/* jump rail — MOBILE fallback (the desktop ribbon accordion owns this sub-nav) */}
        <nav aria-label="connections sections" className="scar-mobile-only flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              data-accent="cyan"
              className="btn-pill btn-pill--muted inline-flex min-h-11 items-center"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </div>

      <section id="spaces" className="scroll-mt-20">
        <SpacesPanel space={SPACE_NAME} />
      </section>

      <section id="chat" className="scroll-mt-20 border-t-2 border-edge/60">
        <ChatPanel />
      </section>

      <section id="mud" className="scroll-mt-20 border-t-2 border-edge/60">
        <MudPanel />
      </section>

      <section id="chain" className="scroll-mt-20 border-t-2 border-edge/60">
        <MempoolPanel />
      </section>

      {/* BRIEFS — the two sources the briefs library pulls from (shared public +
          personal private). The repo/branch editors were consolidated here from
          the Briefs page; the ⟳ PULL action stays on /a/briefs. */}
      <section id="briefs" className="scroll-mt-20 border-t-2 border-edge/60">
        <BriefsConnectPanel />
      </section>

      {/* SHIP — the deploy hook: the door from merged `main` to production. The
          per-card ▲ SHIP on Action Items fires this same hook; connect it once
          here (stored write-only). A merge is never live until a ship. */}
      <section id="deploy" className="scroll-mt-20 border-t-2 border-edge/60">
        <div className="mx-auto max-w-3xl px-6 pt-10">
          <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
            OPERATOR CONSOLE · {CONSOLE_SITE.domain.toUpperCase()}
          </p>
          <h2 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">SHIP</h2>
          <p className="mb-2 font-mono text-[11px] text-white/50">
            THE DOOR TO PRODUCTION · CONNECT — SIGN — DEPLOY
          </p>
        </div>
        <DeployPanel />
      </section>

      <section id="torrents" className="scroll-mt-20 border-t-2 border-edge/60">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
            OPERATOR CONSOLE · {CONSOLE_SITE.domain.toUpperCase()}
          </p>
          <h2 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">TORRENTS</h2>
          <p className="mb-8 font-mono text-[11px] text-white/50">
            SEED THE KNOWLEDGE · POINT — SAVE — TEST
          </p>
          <div className="max-w-2xl">
            <div className="console-card p-5" data-accent="cyan">
              <span className="pill" data-accent="cyan">
                COMING SOON
              </span>
              <p className="mt-3 font-body text-sm text-white/70">
                A torrent berth for the fleet — seed the archive so the knowledge survives even if
                a node goes dark. Same POINT · SAVE · TEST rail as the nodes above; this berth is
                cut and waiting for its wiring.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
