"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { bftDateTime, bftDatePlain, estimateHeight } from "@/lib/bb/bft";

/**
 * The chain node — link this deployment to its OWN mempool instance. The
 * admiral's sovereignty fix (2026-07-11): the fleet reads the block tip + the
 * live mempool fill through /api/chain/tip, which reads THIS node. Point it at
 * Pac's Arcade's self-hosted mempool.space (bitcoind-backed) and the whole
 * fleet stops phoning a third party; leave it empty and it falls back to the
 * public mempool.space so a fresh fork still ticks — honest about which.
 *
 * Same node-link rail as Spaces/MUD/Chat: POINT · SAVE · TEST. No token — it's
 * read-only public chain data, no key ever touches it.
 */

interface MempoolStatus {
  url: string;
  source: "stored" | "env" | "default";
  reachable: boolean;
  height: number | null;
  httpStatus: number | null;
  reason?: string;
}

interface NodesConfig {
  mempoolUrl: string;
  envFallback: { mempoolUrl: string | null };
}

const SOURCE_LABEL: Record<MempoolStatus["source"], string> = {
  stored: "YOUR NODE — SAVED HERE",
  env: "ENV BOOTSTRAP (MEMPOOL_NODE_URL)",
  default: "PUBLIC MEMPOOL.SPACE — FALLBACK",
};

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

export default function MempoolPanel() {
  const [status, setStatus] = useState<MempoolStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<{ height: number; estimated: boolean } | null>(null);
  const [config, setConfig] = useState<NodesConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/mempool/status");
      const data = await res.json();
      if (!data.ok) {
        setError(data.reason ?? "status check failed");
        return;
      }
      setStatus(data);
      /* the test just read the REAL tip — that IS the checked block; only a
         dark node falls back to the honest ~estimate */
      setChecked(
        data.reachable && typeof data.height === "number"
          ? { height: data.height, estimated: false }
          : { height: estimateHeight(), estimated: true },
      );
    } catch {
      setError("couldn't reach the app — try again");
    } finally {
      setBusy(false);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/nodes");
      const data = await res.json();
      if (data.ok) setConfig(data.config);
    } catch {
      /* panel still works read-only */
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadConfig();
  }, [loadStatus, loadConfig]);

  useEffect(() => {
    if (config) setUrl(config.mempoolUrl || config.envFallback.mempoolUrl || "");
  }, [config]);

  async function save() {
    setSaveErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/nodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mempoolUrl: url }),
      });
      const data = await res.json();
      if (!data.ok) {
        setSaveErr(data.reason ?? "couldn't save");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setConfig(data.config);
      loadStatus();
    } catch {
      setSaveErr("save hiccuped — try again");
    } finally {
      setSaving(false);
    }
  }

  const onDefault = status ? status.source === "default" : false;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
        OPERATOR CONSOLE · FRENS.EARTH
      </p>
      <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">CHAIN NODE</h1>
      <p className="mb-8 font-mono text-[11px] text-white/50">
        THE BLOCK TIP + MEMPOOL FILL · POINT — SAVE — TEST
      </p>

      {error && <p className="mb-4 font-pixel text-[10px] uppercase text-ghost">{error}</p>}

      <div className="max-w-2xl space-y-6">
        {/* honest state — still on the public fallback, no own node linked */}
        {status && onDefault && (
          <div className="border-2 border-cyan/60 bg-cyan/5 p-4 font-body text-sm text-white/80">
            <p className="mb-2 font-pixel text-[10px] uppercase text-cyan">
              USING THE PUBLIC MEMPOOL.SPACE (FALLBACK) — POINT YOUR OWN BELOW
            </p>
            <p>
              The fleet reads the block tip and the live mempool fill through this node. Right now
              that is the public{" "}
              <span className="font-mono text-cyan">mempool.space</span> — a third party. Stand up
              your own mempool instance against bitcoind and point it here; the fleet stops phoning
              out. No token — it is read-only public chain data, no key ever touches it.
            </p>
          </div>
        )}

        {/* your node — the boxes: point, save, test */}
        <div className="border-2 border-edge bg-panel p-4">
          <p className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-white/40">
            YOUR NODE — POINT · SAVE · TEST
          </p>
          <label className="block">
            <span className="font-pixel text-[9px] uppercase text-white/40">
              MEMPOOL URL — YOUR OWN INSTANCE
            </span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://mempool.space"
              className="mt-1 w-full border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-cyan placeholder:text-white/25 focus:border-cyan focus:outline-none"
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button onClick={save} disabled={saving} className="button disabled:opacity-50">
              {saving ? "SAVING…" : saved ? "✓ SAVED" : "SAVE & TEST"}
            </button>
            <button
              onClick={loadStatus}
              disabled={busy}
              className="min-h-11 border-2 border-cyan px-4 font-pixel text-[9px] uppercase text-cyan hover:glow-cyan disabled:opacity-50"
            >
              {busy ? "TESTING…" : "TEST CONNECTION"}
            </button>
          </div>
          <p className="mt-2 font-body text-xs text-white/50">
            Leave the box empty and save to fall back to the public mempool.space.
          </p>
          {saveErr && <p className="mt-2 font-pixel text-[9px] uppercase text-ghost">{saveErr}</p>}
        </div>

        {/* the link, validated */}
        <div className="border-2 border-edge bg-panel">
          <div className="border-b-2 border-edge px-4 py-2">
            <p className="font-pixel text-[10px] uppercase tracking-widest text-white/40">
              NODE LINK
            </p>
          </div>
          <div className="space-y-3 p-4 font-mono text-xs">
            <Row label="STATUS">
              {!status ? (
                <span className="text-white/40">{busy ? "checking…" : "—"}</span>
              ) : status.reachable ? (
                <Pill ok={true}>REACHABLE</Pill>
              ) : (
                <Pill ok={false}>UNREACHABLE</Pill>
              )}
            </Row>
            <Row label="NODE">
              <span className="break-all text-cyan">{status?.url ?? "—"}</span>
            </Row>
            <Row label="SOURCE">{status ? SOURCE_LABEL[status.source] : "—"}</Row>
            <Row label="TIP">
              {status?.reachable && status.height != null ? (
                <span className="text-white/80">
                  ★{status.height.toLocaleString()}{" "}
                  <span className="text-white/40">· {bftDatePlain(status.height)}</span>
                </span>
              ) : (
                <span className="text-white/40">—</span>
              )}
            </Row>
            <Row label="CHECKED">
              {checked != null ? (
                <span className="text-white/60">
                  {checked.estimated ? "~ " : ""}
                  {bftDateTime(checked.height)}
                </span>
              ) : (
                "—"
              )}
            </Row>
            {status?.reason && (
              <Row label="NOTE">
                <span className="text-ghost">{status.reason}</span>
              </Row>
            )}
          </div>
        </div>

        <p className="text-center font-pixel text-[9px] uppercase text-white/40">
          NO TOKEN — READ-ONLY PUBLIC CHAIN DATA. THE FLEET READS THE TIP THROUGH /api/chain/tip.
        </p>
      </div>
    </div>
  );
}
