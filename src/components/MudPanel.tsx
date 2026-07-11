"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

/**
 * "Connect your MUD" — the admiral points this deployment at its own P.O.K.E.
 * MUD node (knowledge-engine, admin API on :4001), tests the link, and sees it
 * verified. Same node-link rail as the Spaces panel. The game engine + LLM
 * hookups live on the node; this is just the link.
 */

interface MudStatus {
  configured: boolean;
  hasToken?: boolean;
  reachable?: boolean;
  authed?: boolean;
  world?: Record<string, unknown> | null;
  reason?: string;
}

function Pill({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-block border-2 px-2 py-0.5 font-pixel text-[9px] uppercase ${
        ok ? "border-neon text-neon glow-neon" : "border-ghost text-ghost"
      }`}
    >
      {children}
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-pixel text-[9px] uppercase text-white/40">{label}</span>
      <span className="text-right text-white/80">{children}</span>
    </div>
  );
}

export default function MudPanel() {
  const [status, setStatus] = useState<MudStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/mud/status");
      const data = await res.json();
      if (!data.ok) {
        setError(data.reason ?? "status check failed");
        return;
      }
      setStatus(data);
    } catch {
      setError("couldn't reach the app — try again");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const configured = !!status?.configured;
  const reachable = configured && !!status?.reachable;
  const authed = reachable && !!status?.authed;
  const worldName =
    (status?.world && (status.world.verse ?? status.world.name ?? status.world.world)) || null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
        OPERATOR CONSOLE ▸ FRENS.EARTH
      </p>
      <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">MUD NODE</h1>
      <p className="mb-8 font-mono text-[11px] text-white/50">
        POINT THIS DEPLOYMENT AT YOUR OWN P.O.K.E. MUD NODE — TEST — VERIFIED
      </p>

      {error && <p className="mb-4 font-pixel text-[10px] uppercase text-ghost">{error}</p>}

      <div className="max-w-2xl space-y-6">
        <div className="border-2 border-edge bg-panel">
          <div className="flex items-center justify-between border-b-2 border-edge px-4 py-2">
            <p className="font-pixel text-[10px] uppercase tracking-widest text-white/40">NODE LINK</p>
            <button
              onClick={load}
              disabled={busy}
              className="border-2 border-cyan px-3 py-1 font-pixel text-[9px] uppercase text-cyan hover:glow-cyan disabled:opacity-50"
            >
              {busy ? "TESTING…" : "TEST CONNECTION"}
            </button>
          </div>
          <div className="space-y-3 p-4 font-mono text-xs">
            <Row label="STATUS">
              {!configured ? (
                <Pill ok={false}>NOT CONFIGURED</Pill>
              ) : reachable ? (
                <Pill ok={true}>REACHABLE</Pill>
              ) : (
                <Pill ok={false}>UNREACHABLE</Pill>
              )}
            </Row>
            <Row label="ADMIN TOKEN">
              {!configured || !status?.hasToken ? (
                <span className="text-white/40">not set</span>
              ) : authed ? (
                <Pill ok={true}>VERIFIED</Pill>
              ) : (
                <Pill ok={false}>REJECTED</Pill>
              )}
            </Row>
            <Row label="WORLD">
              {worldName ? <span className="text-cyan">{String(worldName)}</span> : "—"}
            </Row>
            {status?.reason && (
              <Row label="NOTE">
                <span className="text-ghost">{status.reason}</span>
              </Row>
            )}
          </div>
        </div>

        {!configured && (
          <div className="border-2 border-coin/60 bg-coin/5 p-4 font-body text-sm text-white/80">
            <p className="mb-2 font-pixel text-[10px] uppercase text-coin">CONNECT YOUR MUD</p>
            <p className="mb-3">
              The MUD engine runs as its own node (knowledge-engine, admin on{" "}
              <span className="font-mono text-cyan">:4001</span>). Run it, then set{" "}
              <span className="font-mono text-cyan">MUD_NODE_URL</span> and{" "}
              <span className="font-mono text-cyan">MUD_ADMIN_TOKEN</span> in this deployment&apos;s
              env and reload. The game can be dark and everything else here still works —
              tickets don&apos;t need the game running.
            </p>
            <p className="font-mono text-[11px] text-white/50">MUD_NODE_URL=http://127.0.0.1:4001</p>
          </div>
        )}
      </div>
    </div>
  );
}
