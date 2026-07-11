"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

/**
 * The Spaces node console — the "admiral" connects this deployment's OWN
 * `spaced` node, watches the chain, sees the queue, and runs the batch anchor
 * ceremony. Read/status is live over the node's JSON-RPC; the on-chain commit
 * is a deliberate manual, wallet-signed step on the local console (keys never
 * touch a server) — this panel guides it and records the result. Cloneable:
 * every operator points at their own node. Follows the MUD admin's
 * connection-rail conventions + the operator-console house style.
 */

type Tab = "connection" | "queue" | "anchor";

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

function shortNpub(npub: string): string {
  return npub.length > 16 ? `${npub.slice(0, 10)}…${npub.slice(-4)}` : npub;
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

export default function SpacesPanel({ space }: { space: string }) {
  const [tab, setTab] = useState<Tab>("connection");
  const [status, setStatus] = useState<NodeStatus | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [queue, setQueue] = useState<QueuedEntry[] | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);
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

  useEffect(() => {
    loadStatus();
    loadQueue();
  }, [loadStatus, loadQueue]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "connection", label: "CONNECTION" },
    { id: "queue", label: queue ? `QUEUE · ${queue.length}` : "QUEUE" },
    { id: "anchor", label: "ANCHOR" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
        OPERATOR CONSOLE ▸ FRENS.EARTH
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
            className={`min-h-11 border-2 px-4 py-2 font-pixel text-[10px] uppercase ${
              tab === t.id
                ? "border-cyan text-cyan glow-cyan"
                : "border-edge text-white/50 hover:text-white/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 font-pixel text-[10px] uppercase text-ghost">{error}</p>}

      {tab === "connection" && (
        <ConnectionTab space={space} status={status} busy={statusBusy} onTest={loadStatus} />
      )}
      {tab === "queue" && <QueueTab queue={queue} busy={queueBusy} space={space} onReload={loadQueue} />}
      {tab === "anchor" && (
        <AnchorTab space={space} queueCount={queue?.length ?? null} onCommitted={loadQueue} />
      )}
    </div>
  );
}

function ConnectionTab({
  space,
  status,
  busy,
  onTest,
}: {
  space: string;
  status: NodeStatus | null;
  busy: boolean;
  onTest: () => void;
}) {
  const configured = !!status?.configured;
  const reachable = configured && !!status?.reachable;
  const owner = status?.spaceOwner;
  const tip = status?.tip;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="border-2 border-edge bg-panel">
        <div className="flex items-center justify-between border-b-2 border-edge px-4 py-2">
          <p className="font-pixel text-[10px] uppercase tracking-widest text-white/40">NODE LINK</p>
          <button
            onClick={onTest}
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
          <Row label="CHAIN">{status?.chain ?? "—"}</Row>
          <Row label="BLOCK">
            {tip?.height != null ? (
              <span className="text-coin glow-coin">{tip.height.toLocaleString()}</span>
            ) : (
              "—"
            )}
          </Row>
          <Row label={`OWNS @${space}`}>
            {owner ? <Pill ok={true}>YES</Pill> : reachable ? <Pill ok={false}>NOT FOUND</Pill> : "—"}
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
          <p className="mb-2 font-pixel text-[10px] uppercase text-coin">CONNECT YOUR NODE</p>
          <p className="mb-3">
            Anchoring runs against <span className="text-cyan">your own</span> spaced node. Run{" "}
            <span className="font-mono text-cyan">spaced</span> on your console, then set{" "}
            <span className="font-mono text-cyan">SPACES_NODE_URL</span> (and{" "}
            <span className="font-mono text-cyan">SPACES_NODE_TOKEN</span> if it sits behind a
            proxy) in this deployment&apos;s env and reload. Until then, tags stay{" "}
            <span className="text-neon">queued</span> — still fully usable on nostr.
          </p>
          <p className="font-mono text-[11px] text-white/50">SPACES_NODE_URL=http://127.0.0.1:7225</p>
        </div>
      )}
    </div>
  );
}

function QueueTab({
  queue,
  busy,
  space,
  onReload,
}: {
  queue: QueuedEntry[] | null;
  busy: boolean;
  space: string;
  onReload: () => void;
}) {
  return (
    <div className="max-w-3xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-pixel text-xs">
          <span className="text-neon glow-neon">{queue?.length ?? 0} QUEUED</span>{" "}
          <span className="text-white/40">— waiting for the next batch anchor</span>
        </p>
        <button
          onClick={onReload}
          disabled={busy}
          className="border-2 border-edge px-3 py-1 font-pixel text-[9px] uppercase text-white/60 hover:text-white/90 disabled:opacity-50"
        >
          {busy ? "…" : "RELOAD"}
        </button>
      </div>
      {!queue || queue.length === 0 ? (
        <p className="font-body text-sm text-white/50">
          {busy ? "Reading the queue…" : "No tags queued right now."}
        </p>
      ) : (
        <div className="border-2 border-edge">
          {queue.map((e) => (
            <div
              key={e.handle}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-edge px-4 py-2 font-mono text-xs last:border-b-0"
            >
              <span className="text-cyan">
                {e.handle}@{space}
              </span>
              <span className="text-white/40">{shortNpub(e.npub)}</span>
              <span className="text-white/40">
                {e.blockHeight != null
                  ? `BLOCK ${e.blockHeight.toLocaleString()}`
                  : new Date(e.requestedAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnchorTab({
  space,
  queueCount,
  onCommitted,
}: {
  space: string;
  queueCount: number | null;
  onCommitted: () => void;
}) {
  const [batchId, setBatchId] = useState("");
  const [proofsText, setProofsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    committed: string[];
    skipped: { handle: string; reason: string }[];
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
    setBusy(true);
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
      onCommitted();
    } catch {
      setErr("commit hiccuped — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="border-l-4 border-pink bg-pink/5 p-4">
        <p className="font-body text-sm text-white/80">
          <span className="font-pixel text-[10px] text-pink">CEREMONY · </span>
          The batch commit is a manual, wallet-signed step on this local console — keys never
          touch a server. Run <span className="font-mono text-cyan">subs</span> against the{" "}
          {queueCount ?? "queued"} {queueCount === 1 ? "tag" : "tags"} to build the Merkle root,
          sign + broadcast with the @{space} wallet, then record the result below to flip them{" "}
          <span className="text-neon">etched</span>.
        </p>
      </div>

      <label className="block">
        <span className="font-pixel text-[9px] uppercase text-white/40">
          BATCH ID — ON-CHAIN ROOT / TXID
        </span>
        <input
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          className="mt-1 w-full border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-cyan focus:border-cyan focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="font-pixel text-[9px] uppercase text-white/40">
          PROOFS — JSON ARRAY OF {"{ handle, proof }"}
        </span>
        <textarea
          value={proofsText}
          onChange={(e) => setProofsText(e.target.value)}
          rows={6}
          placeholder='[{ "handle": "alice", "proof": "…" }]'
          className="mt-1 w-full border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-white/80 placeholder:text-white/25 focus:border-cyan focus:outline-none"
        />
      </label>
      <button
        onClick={commit}
        disabled={busy}
        className="button block w-full text-center disabled:opacity-50"
      >
        {busy ? "RECORDING…" : "▶ RECORD BATCH COMMIT"}
      </button>
      {err && <p className="font-pixel text-[10px] uppercase text-ghost">{err}</p>}
      {result && (
        <div className="border-2 border-neon/50 bg-neon/5 p-4 font-mono text-xs">
          <p className="text-neon glow-neon">✓ {result.committed.length} ETCHED</p>
          {result.committed.length > 0 && (
            <p className="mt-1 text-white/60">{result.committed.join(", ")}</p>
          )}
          {result.skipped.length > 0 && (
            <p className="mt-2 text-coin">
              SKIPPED: {result.skipped.map((s) => `${s.handle} (${s.reason})`).join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
