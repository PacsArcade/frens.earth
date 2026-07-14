"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { bftDate, bftDateTime, estimateHeight } from "@/lib/bb/bft";

/**
 * The Spaces node console, v2 (the admiral's cleanup, 2026-07-11):
 *   NODE     — URL boxes: enter, save, TEST your own server connection.
 *   ANCHOR   — the queue (with the 🗑 for bad registrations) + record the
 *              batch commit. One tab: the queue IS the ceremony's input.
 *   CEREMONY — what a batch SENDS: cert template + the welcome letter,
 *              configurable per POKE node. (Sparks parked: the welcome
 *              letter rides the newsletter and posts to @frens on nostr.)
 * All dates are Bitcoin Federated Time — the old calendar is burned; rows
 * without a recorded block get a best-effort ~estimate from their timestamp.
 */

type Tab = "node" | "anchor" | "ceremony";

interface NodeStatus {
  configured: boolean;
  reachable?: boolean;
  space?: string;
  chain?: string | null;
  tip?: { height?: number; hash?: string } | null;
  spaceOwner?: unknown;
  reason?: string;
}
interface QueuedEntry {
  handle: string;
  npub: string;
  requestedAt: string;
  blockHeight: number | null;
}
interface NodesConfig {
  spacesUrl: string;
  spacesTokenSet: boolean;
  ceremony: { certTemplate: string; welcomeMessage: string };
  envFallback: { spacesUrl: string | null };
}

function shortNpub(n: string): string {
  return n.length > 15 ? `${n.slice(0, 10)}…${n.slice(-4)}` : n;
}

/** BFT stamp for a queue row, house standard (yyyy.mm.dd hh:mm — the a₿
    marker is assumed on new items): the real block when recorded, a
    ~estimate from the claim timestamp when not. */
function bftStamp(e: QueuedEntry): string {
  if (e.blockHeight != null)
    return `▣ ${e.blockHeight.toLocaleString()} · ${bftDateTime(e.blockHeight)}`;
  return `~ ${bftDateTime(estimateHeight(new Date(e.requestedAt).getTime()))}`;
}

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

export default function SpacesPanel({ space }: { space: string }) {
  const [tab, setTab] = useState<Tab>("node");
  const [status, setStatus] = useState<NodeStatus | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [queue, setQueue] = useState<QueuedEntry[] | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [config, setConfig] = useState<NodesConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setStatusBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/spaces/status?space=${encodeURIComponent(space)}`);
      const data = await res.json();
      if (!data.ok) {
        setError(data.reason ?? "status check failed");
        return;
      }
      setStatus(data);
    } catch {
      setError("couldn't reach the app — try again");
    } finally {
      setStatusBusy(false);
    }
  }, [space]);

  const loadQueue = useCallback(async () => {
    setQueueBusy(true);
    try {
      const res = await fetch(`/api/admin/batch/export?space=${encodeURIComponent(space)}`);
      const data = await res.json();
      if (data.ok) setQueue(data.entries);
    } catch {
      /* leave whatever we had */
    } finally {
      setQueueBusy(false);
    }
  }, [space]);

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
    loadQueue();
    loadConfig();
  }, [loadStatus, loadQueue, loadConfig]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "node", label: "NODE" },
    { id: "anchor", label: queue ? `ANCHOR · ${queue.length}` : "ANCHOR" },
    { id: "ceremony", label: "CEREMONY" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <p className="lcars-eyebrow mb-3" data-accent="cyan">
        OPERATOR CONSOLE · FRENS.EARTH
      </p>
      <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">SPACES NODE</h1>
      <p className="mb-8 font-mono text-[11px] text-white/50">
        ANCHORING @{space} SUBSPACES TO BITCOIN VIA YOUR OWN spaced NODE
      </p>

      <div className="mb-8 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            data-accent="cyan"
            className={`btn-pill ${tab === t.id ? "btn-pill--solid" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 font-pixel text-[10px] uppercase text-ghost">{error}</p>}

      {tab === "node" && (
        <NodeTab
          space={space}
          status={status}
          busy={statusBusy}
          config={config}
          onSaved={(c) => {
            setConfig(c);
            loadStatus();
          }}
          onTest={loadStatus}
        />
      )}
      {tab === "anchor" && (
        <AnchorTab space={space} queue={queue} busy={queueBusy} onReload={loadQueue} />
      )}
      {tab === "ceremony" &&
        (config ? (
          <CeremonyTab config={config} onSaved={setConfig} />
        ) : (
          <p className="font-body text-sm text-white/50">Reading the ceremony config…</p>
        ))}
    </div>
  );
}

// ── NODE — enter, save, test your server connection ─────────────────────────

function NodeTab({
  space,
  status,
  busy,
  config,
  onSaved,
  onTest,
}: {
  space: string;
  status: NodeStatus | null;
  busy: boolean;
  config: NodesConfig | null;
  onSaved: (c: NodesConfig) => void;
  onTest: () => void;
}) {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (config) setUrl(config.spacesUrl || config.envFallback.spacesUrl || "");
  }, [config]);

  async function save() {
    setErr(null);
    setSaving(true);
    try {
      const body: Record<string, string> = { spacesUrl: url };
      if (token) body.spacesToken = token; // write-only — never round-trips
      const res = await fetch("/api/admin/nodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        setErr(data.reason ?? "couldn't save");
        return;
      }
      setToken("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved(data.config);
    } catch {
      setErr("save hiccuped — try again");
    } finally {
      setSaving(false);
    }
  }

  const configured = !!status?.configured;
  const reachable = configured && !!status?.reachable;
  const tip = status?.tip;

  return (
    <div className="max-w-2xl space-y-6">
      {/* your server — the boxes the admiral asked for */}
      <div className="console-card p-4" data-accent="cyan">
        <p className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-white/40">
          YOUR SERVER — POINT · SAVE · TEST
        </p>
        <label className="block">
          <span className="font-pixel text-[9px] uppercase text-white/40">
            NODE URL — YOUR spaced JSON-RPC (OR ITS PROXY)
          </span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://127.0.0.1:7225"
            className="mt-1 w-full rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-cyan placeholder:text-white/25 focus:border-cyan focus:outline-none"
          />
        </label>
        <label className="mt-3 block">
          <span className="font-pixel text-[9px] uppercase text-white/40">
            TOKEN {config?.spacesTokenSet ? "— SET ✓ (ENTER TO REPLACE)" : "— OPTIONAL (PROXY BEARER)"}
          </span>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            type="password"
            placeholder={config?.spacesTokenSet ? "••••••••" : "leave empty for a local node"}
            className="mt-1 w-full rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-white/80 placeholder:text-white/25 focus:border-cyan focus:outline-none"
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
          <button onClick={onTest} disabled={busy} data-accent="cyan" className="btn-pill">
            {busy ? "TESTING…" : "TEST CONNECTION"}
          </button>
        </div>
        {err && <p className="mt-2 font-pixel text-[9px] uppercase text-ghost">{err}</p>}
      </div>

      {/* the link, validated */}
      <div className="console-card overflow-hidden" data-accent="cyan">
        <div className="border-b border-edge px-4 py-2.5">
          <p className="font-pixel text-[10px] uppercase tracking-widest text-white/40">NODE LINK</p>
        </div>
        <div className="space-y-3 p-4 font-mono text-xs">
          <Row label="STATUS">
            {!configured ? (
              <Pill ok={false}>NOT CONFIGURED</Pill>
            ) : reachable ? (
              <Pill ok={true}>VALIDATED</Pill>
            ) : (
              <Pill ok={false}>UNREACHABLE</Pill>
            )}
          </Row>
          <Row label="CHAIN">{status?.chain ?? "—"}</Row>
          <Row label="BLOCK">
            {tip?.height != null ? (
              <span className="text-coin glow-coin">
                ▣ {tip.height.toLocaleString()} · {bftDate(tip.height)}
              </span>
            ) : (
              "—"
            )}
          </Row>
          <Row label={`OWNS @${space}`}>
            {status?.spaceOwner ? (
              <Pill ok={true}>YES</Pill>
            ) : reachable ? (
              <Pill ok={false}>NOT FOUND</Pill>
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
    </div>
  );
}

// ── ANCHOR — the queue (with the 🗑) + record the batch commit ───────────────

function AnchorTab({
  space,
  queue,
  busy,
  onReload,
}: {
  space: string;
  queue: QueuedEntry[] | null;
  busy: boolean;
  onReload: () => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [batchId, setBatchId] = useState("");
  const [proofsText, setProofsText] = useState("");
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<{
    committed: string[];
    skipped: { handle: string; reason: string }[];
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function release(handle: string) {
    if (confirming !== handle) {
      setConfirming(handle); // two taps — no accidental trashing
      setTimeout(() => setConfirming((c) => (c === handle ? null : c)), 3000);
      return;
    }
    setConfirming(null);
    const res = await fetch("/api/admin/batch/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, space }),
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false, reason: "release hiccuped" }));
    if (!res.ok) setErr(res.reason);
    onReload();
  }

  async function commit() {
    setErr(null);
    setResult(null);
    let items: unknown;
    try {
      items = JSON.parse(proofsText);
      if (!Array.isArray(items)) throw new Error();
    } catch {
      setErr("proofs must be a JSON array of { handle, proof }");
      return;
    }
    if (!batchId.trim()) {
      setErr("batch id (the on-chain root / txid) is required");
      return;
    }
    setCommitting(true);
    try {
      const res = await fetch("/api/admin/batch/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space, batchId: batchId.trim(), items }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErr(data.reason ?? "commit failed");
        return;
      }
      setResult({ committed: data.committed, skipped: data.skipped });
      onReload();
    } catch {
      setErr("commit hiccuped — try again");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-pixel text-xs">
            <span className="text-neon glow-neon">{queue?.length ?? 0} QUEUED</span>{" "}
            <span className="text-white/40">— the next batch&apos;s passenger list</span>
          </p>
          <button
            onClick={onReload}
            disabled={busy}
            data-accent="cyan"
            className="btn-pill btn-pill--muted"
          >
            {busy ? "…" : "⟳ RELOAD"}
          </button>
        </div>
        {!queue || queue.length === 0 ? (
          <p className="font-body text-sm text-white/50">
            {busy ? "Reading the queue…" : "No tags queued right now."}
          </p>
        ) : (
          <div className="console-card overflow-hidden" data-accent="cyan">
            {queue.map((e) => (
              <div
                key={e.handle}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-edge px-4 py-2 font-mono text-xs last:border-b-0"
              >
                <span className="text-cyan">
                  {e.handle}@{space}
                </span>
                <span className="text-white/40">{shortNpub(e.npub)}</span>
                <span className="text-white/40">{bftStamp(e)}</span>
                <button
                  onClick={() => release(e.handle)}
                  title="release this name back to the pool (queued only)"
                  data-accent="ghost"
                  className={`btn-pill ${confirming === e.handle ? "" : "btn-pill--muted"}`}
                >
                  {confirming === e.handle ? "SURE? 🗑" : "🗑"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-r-xl border-l-4 border-pink bg-pink/5 p-4">
        <p className="font-body text-sm text-white/80">
          <span className="font-pixel text-[10px] text-pink">CEREMONY STEP · </span>
          Run <span className="font-mono text-cyan">subs</span> against the queue above, sign +
          broadcast with the @{space} wallet on your console (keys never touch a server), then
          record the result to flip them <span className="text-neon">etched</span>.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="font-pixel text-[9px] uppercase text-white/40">
            BATCH ID — ON-CHAIN ROOT / TXID
          </span>
          <input
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="mt-1 w-full rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-cyan focus:border-cyan focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="font-pixel text-[9px] uppercase text-white/40">
            PROOFS — JSON ARRAY OF {"{ handle, proof }"}
          </span>
          <textarea
            value={proofsText}
            onChange={(e) => setProofsText(e.target.value)}
            rows={5}
            placeholder='[{ "handle": "alice", "proof": "…" }]'
            className="mt-1 w-full rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-white/80 placeholder:text-white/25 focus:border-cyan focus:outline-none"
          />
        </label>
        <button
          onClick={commit}
          disabled={committing}
          data-accent="cyan"
          className="btn-pill btn-pill--solid flex w-full"
        >
          {committing ? "RECORDING…" : "▶ RECORD BATCH COMMIT"}
        </button>
        {err && <p className="font-pixel text-[10px] uppercase text-ghost">{err}</p>}
        {result && (
          <div className="rounded-xl border-2 border-neon/50 bg-neon/5 p-4 font-mono text-xs">
            <p className="text-neon glow-neon">✓ {result.committed.length} ETCHED</p>
            {result.committed.length > 0 && (
              <p className="mt-1 text-white/60">{result.committed.join(", ")}</p>
            )}
            {result.skipped.length > 0 && (
              /* ghost, not coin — a skip is a warning; gold stays money-only */
              <p className="mt-2 text-ghost">
                SKIPPED: {result.skipped.map((s) => `${s.handle} (${s.reason})`).join(", ")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── CEREMONY — what a batch sends, per POKE node ─────────────────────────────

function CeremonyTab({
  config,
  onSaved,
}: {
  config: NodesConfig;
  onSaved: (c: NodesConfig) => void;
}) {
  const [certTemplate, setCertTemplate] = useState(config.ceremony.certTemplate);
  const [welcomeMessage, setWelcomeMessage] = useState(config.ceremony.welcomeMessage);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/nodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ceremony: { certTemplate, welcomeMessage } }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErr(data.reason ?? "couldn't save");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved(data.config);
    } catch {
      setErr("save hiccuped — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <p className="font-body text-sm text-white/70">
        What a batch ceremony <span className="text-cyan">sends</span> — configurable per POKE
        node. The certificate ships as box art (the block decides the case), and the welcome
        letter greets every fren etched in the batch.{" "}
        <span className="text-white/40">
          Parked sparks: the letter rides the newsletter, and posts to the @frens nostr profile
          with hashtags.
        </span>
      </p>
      <label className="block">
        <span className="font-pixel text-[9px] uppercase text-white/40">CERTIFICATE TEMPLATE</span>
        <select
          value={certTemplate}
          onChange={(e) => setCertTemplate(e.target.value)}
          className="mt-1 w-full rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-cyan focus:border-cyan focus:outline-none"
        >
          <option value="bft-auto">BFT AUTO — the block picks the case (house default)</option>
          <option value="keepsake">KEEPSAKE — naming-ceremony inscription card</option>
          <option value="plain">PLAIN — rune + proof, no dressing</option>
        </select>
      </label>
      <label className="block">
        <span className="font-pixel text-[9px] uppercase text-white/40">
          THE WELCOME LETTER — SENT WITH EVERY ETCH
        </span>
        <textarea
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value)}
          rows={6}
          placeholder="Welcome home, fren — your name is on the block now…"
          className="mt-1 w-full rounded-lg border-2 border-edge bg-void px-3 py-2 font-body text-sm text-white/80 placeholder:text-white/25 focus:border-cyan focus:outline-none"
        />
      </label>
      <button
        onClick={save}
        disabled={saving}
        data-accent="cyan"
        className="btn-pill btn-pill--solid flex w-full"
      >
        {saving ? "SAVING…" : saved ? "✓ SAVED — RIDES THE NEXT CEREMONY" : "SAVE CEREMONY"}
      </button>
      {err && <p className="font-pixel text-[10px] uppercase text-ghost">{err}</p>}
    </div>
  );
}
