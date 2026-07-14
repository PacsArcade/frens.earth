"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { bftDateTime, currentBlockInfo } from "@/lib/bb/bft";

/**
 * The chat floor — link this deployment to its orbee door (chat.frens.earth
 * by default). Mirrors the arcade's pattern for chat.pacsarcade.org: orbee is
 * the nostr NIP-29 group-chat floor and its domain is a DOOR, not an embed —
 * fabric-web resolves tags live, nothing to provision. Same node-link rail as
 * Spaces/MUD: POINT · SAVE · TEST, then OPEN THE CHAT in a new tab (links off
 * the console never steal your place). The door goes through /chat — the
 * fren-session gate — never the raw node URL: the floor is for signed-in
 * frens, and the gate is the one that checks.
 */

interface ChatStatus {
  url: string;
  source: "stored" | "env" | "default";
  reachable: boolean;
  httpStatus: number | null;
  reason?: string;
}

interface NodesConfig {
  chatUrl: string;
  envFallback: { chatUrl: string | null };
}

const SOURCE_LABEL: Record<ChatStatus["source"], string> = {
  stored: "YOUR NODE — SAVED HERE",
  env: "ENV BOOTSTRAP (CHAT_NODE_URL)",
  default: "HOUSE FLOOR — DEFAULT",
};

function Pill({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span className="pill" data-accent={ok ? "neon" : "ghost"}>
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

export default function ChatPanel() {
  const [status, setStatus] = useState<ChatStatus | null>(null);
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
      const res = await fetch("/api/admin/chat/status");
      const data = await res.json();
      if (!data.ok) {
        setError(data.reason ?? "status check failed");
        return;
      }
      setStatus(data);
      /* stamp the check with the REAL tip through the fleet's own door
         (currentBlockInfo → /api/chain/tip); ~ only when the network is dark */
      setChecked(await currentBlockInfo());
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
    if (config) setUrl(config.chatUrl || config.envFallback.chatUrl || "");
  }, [config]);

  async function save() {
    setSaveErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/nodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatUrl: url }),
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

  const linked = status ? status.source !== "default" : false;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <p className="lcars-eyebrow mb-3" data-accent="cyan">
        OPERATOR CONSOLE · FRENS.EARTH
      </p>
      <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">CHAT FLOOR</h1>
      <p className="mb-8 font-mono text-[11px] text-white/50">
        ORBEE — THE FLOOR CHAT · POINT — SAVE — TEST — OPEN THE DOOR
      </p>

      {error && <p className="mb-4 font-pixel text-[10px] uppercase text-ghost">{error}</p>}

      <div className="max-w-2xl space-y-6">
        {/* honest state — a fresh deployment hasn't linked its own floor yet */}
        {status && !linked && (
          <div className="rounded-xl border-2 border-cyan/60 bg-cyan/5 p-4 font-body text-sm text-white/80">
            <p className="mb-2 font-pixel text-[10px] uppercase text-cyan">
              CHAT NODE NOT LINKED YET — POINT IT BELOW
            </p>
            <p>
              The door falls back to the house floor at{" "}
              <span className="font-mono text-cyan">chat.frens.earth</span>. Orbee needs no write —
              the floor resolves tags live — so the default already works; point your own orbee
              here when you run one.
            </p>
          </div>
        )}

        {/* your floor — the boxes: point, save, test */}
        <div className="console-card p-4" data-accent="cyan">
          <p className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-white/40">
            YOUR FLOOR — POINT · SAVE · TEST
          </p>
          <label className="block">
            <span className="font-pixel text-[9px] uppercase text-white/40">
              CHAT URL — YOUR ORBEE DOOR
            </span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://chat.frens.earth"
              className="mt-1 w-full rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-cyan placeholder:text-white/25 focus:border-cyan focus:outline-none"
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              data-accent="cyan"
              className="btn-pill btn-pill--solid"
            >
              {saving ? "SAVING…" : saved ? "✓ SAVED" : "▶ SAVE & TEST"}
            </button>
            <button onClick={loadStatus} disabled={busy} data-accent="cyan" className="btn-pill">
              {busy ? "TESTING…" : "TEST CONNECTION"}
            </button>
          </div>
          <p className="mt-2 font-body text-xs text-white/50">
            Leave the box empty and save to fall back to the house floor.
          </p>
          {saveErr && <p className="mt-2 font-pixel text-[9px] uppercase text-ghost">{saveErr}</p>}
        </div>

        {/* the link, validated */}
        <div className="console-card overflow-hidden" data-accent="cyan">
          <div className="border-b border-edge px-4 py-2.5">
            <p className="font-pixel text-[10px] uppercase tracking-widest text-white/40">
              FLOOR LINK
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
            <Row label="DOOR">
              <span className="break-all text-cyan">{status?.url ?? "—"}</span>
            </Row>
            <Row label="SOURCE">{status ? SOURCE_LABEL[status.source] : "—"}</Row>
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

        {/* the door itself — through /chat, the fren-session gate: signed-in
            frens bounce on to the node above, anonymous visitors meet /login.
            Never the raw node URL. A new tab; links off the console never
            steal your place. */}
        <a
          href="/chat"
          target="_blank"
          rel="noopener noreferrer"
          data-accent="cyan"
          className="btn-pill btn-pill--solid flex w-full"
        >
          OPEN THE CHAT ▸
        </a>
        <p className="text-center font-pixel text-[9px] uppercase text-white/40">
          THE DOOR IS /chat — THE FREN GATE. THE NODE ITSELF IS NEVER LINKED RAW.
        </p>
      </div>
    </div>
  );
}
