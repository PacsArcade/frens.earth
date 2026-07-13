"use client";

import { useCallback, useEffect, useState } from "react";
import { bftDateTime } from "@/lib/bb/bft";

/**
 * SHIP — SCAR's sign-to-deploy lane. The admiral used to ship from a terminal
 * (`npx vercel deploy --prod --yes`); here it's one key-signed button. The exact
 * twin of MergeQueue's authorize(): sign `PACS-DEPLOY-<ts>` (kind 22242) with
 * the operator key, POST `{ event }`, and the server verifies the signature
 * against the allowlist, fires the Vercel Deploy Hook, and records the ship.
 * Merge ≠ live — this is what turns the current main into production.
 *
 * The two UIs live in two rooms and share one GET (`/api/admin/deploy` →
 * `{configured, deploys}`), split by `mode`:
 *   • "connect" → CONNECTIONS: the one-time connect box (a deploy hook is a
 *     connection, like the nodes). Paste the hook once, stored write-only.
 *   • "ship" → ACTION ITEMS: the ▲ SHIP button + recent-ships log when the
 *     hook is connected; a "connect it in Connections first →" pointer when not.
 *
 * Accent: neon = live/ship. NOT coin — gold is money only (house color law).
 */

interface DeployRecord {
  by: string; // signer pubkey hex
  at: number; // BFT block height
  jobId: string;
  ts: number;
}

export default function DeployPanel({ mode = "ship" }: { mode?: "connect" | "ship" }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [deploys, setDeploys] = useState<DeployRecord[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const res = await fetch("/api/admin/deploy");
      if (res.status === 401) {
        setConfigured(false);
        setLoadErr("operator sign-in required");
        return;
      }
      const data = await res.json();
      if (!data.ok) {
        setLoadErr(data.reason ?? "couldn't read the ship log");
        return;
      }
      setConfigured(!!data.configured);
      setDeploys(Array.isArray(data.deploys) ? data.deploys : []);
    } catch {
      setLoadErr("couldn't reach the app — try again");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (mode === "connect") {
    return <DeployConnect configured={configured} loadErr={loadErr} onConnected={load} />;
  }
  return <DeployShip configured={configured} deploys={deploys} loadErr={loadErr} reload={load} />;
}

/* ── CONNECTIONS · the one-time connect box ──────────────────────────────────
   A deploy hook is a connection, like the admiral's nodes — so it lives here,
   as its own labeled section matching Spaces/Chat/MUD/Chain. Paste the Vercel
   Deploy Hook URL once; it's stored write-only (masked forever after, like the
   GitHub token) and the SHIP button over on Action Items does the rest. */
function DeployConnect({
  configured,
  loadErr,
  onConnected,
}: {
  configured: boolean | null;
  loadErr: string | null;
  onConnected: () => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function connect() {
    setErr(null);
    if (!url.trim()) {
      setErr("paste the deploy hook URL first");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hook: url.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setErr(data?.reason ?? "couldn't save the hook — try again");
        return;
      }
      setUrl("");
      onConnected();
    } catch {
      setErr("couldn't reach the server — check your connection and try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
        OPERATOR CONSOLE · FRENS.EARTH
      </p>
      <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">SHIP HOOK</h1>
      <p className="mb-8 font-mono text-[11px] text-white/50">
        VERCEL · SHIP HOOK — PASTE ONCE · STORED WRITE-ONLY
      </p>

      {loadErr && <p className="mb-4 font-pixel text-[10px] uppercase text-ghost">{loadErr}</p>}

      <div className="max-w-2xl">
        <div className="console-card p-5" data-accent="neon">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="font-pixel text-[10px] uppercase text-neon">VERCEL · SHIP HOOK</p>
            <span className="pill" data-accent={configured ? "neon" : "ghost"}>
              {configured === null ? "READING…" : configured ? "CONNECTED" : "NOT CONNECTED"}
            </span>
          </div>

          <p className="mb-3 font-body text-xs leading-relaxed text-white/70">
            Vercel → <span className="text-neon">frens-earth</span> → Settings → Git: connect this
            repo, then turn <span className="text-neon">OFF</span> automatic production deployments
            (<span className="font-mono text-neon">git.deploymentEnabled:false</span> — pushes
            won&apos;t deploy, you stay in control). Settings → Git → Deploy Hooks: create one for
            branch <span className="font-mono text-neon">main</span>, copy the URL, paste it here.
            It&apos;s stored write-only and never shown again — sign to ship from{" "}
            <span className="font-mono text-neon">Action Items</span>.
          </p>

          {configured && (
            <p className="mb-3 font-body text-xs leading-relaxed text-white/50">
              A hook is already connected (stored write-only). Paste a new one below to rotate it.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              type="password"
              placeholder="https://api.vercel.com/…/deploy/prj_…"
              disabled={busy}
              className="min-w-0 flex-1 rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-neon placeholder:text-white/25 focus:border-neon focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={connect}
              disabled={busy}
              data-accent="neon"
              className="btn-pill btn-pill--solid px-4"
            >
              {busy ? "SAVING…" : configured ? "▶ REPLACE HOOK" : "▶ CONNECT"}
            </button>
          </div>
          {err && <p className="mt-2 font-pixel text-[9px] uppercase text-ghost">{err}</p>}
        </div>
      </div>
    </div>
  );
}

/* ── ACTION ITEMS · the ▲ SHIP button + ship log ─────────────────────────────
   Configured → sign `PACS-DEPLOY-<ts>` and ship (same pattern as
   MergeQueue.authorize()), plus the recent-ships log. Not configured → a short
   pointer to connect the hook over in Connections first. */
function DeployShip({
  configured,
  deploys,
  loadErr,
  reload,
}: {
  configured: boolean | null;
  deploys: DeployRecord[];
  loadErr: string | null;
  reload: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  /** Sign `PACS-DEPLOY-<ts>` and ship — same pattern as MergeQueue.authorize(). */
  async function ship() {
    setErr(null);
    setNote(null);
    if (!window.nostr?.signEvent) {
      setErr("no signer extension found — your signature is the authorization");
      return;
    }
    setBusy(true);
    let event;
    try {
      event = await window.nostr.signEvent({
        kind: 22242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: `PACS-DEPLOY-${Date.now()}`,
      });
    } catch {
      setErr("signing was declined — nothing shipped");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setErr(data?.reason ?? `the server hiccuped (HTTP ${res.status}) — your signature was fine`);
        return;
      }
      setNote(data.note ?? "deploy triggered ✓");
      reload();
    } catch {
      setErr("couldn't reach the server — check your connection and try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mb-10 max-w-3xl px-6">
      <p className="lcars-eyebrow mb-3" data-accent="neon">
        SHIP · YOUR SIGNATURE TURNS MAIN INTO PRODUCTION
      </p>
      {loadErr && <p className="mb-3 font-pixel text-[10px] uppercase text-ghost">{loadErr}</p>}
      {err && <p className="mb-3 font-pixel text-[10px] uppercase text-ghost">{err}</p>}
      {note && <p className="mb-3 font-pixel text-[10px] uppercase text-neon">{note}</p>}

      {configured === null ? (
        <p className="font-body text-sm text-white/50">Reading the ship log…</p>
      ) : !configured ? (
        <div className="console-card p-5" data-accent="neon">
          <p className="font-body text-sm text-white/70">
            No deploy hook connected yet. Connect it once in{" "}
            <a
              href="/a/connections#deploy"
              className="font-mono text-neon underline decoration-neon/40 underline-offset-2 hover:decoration-neon"
            >
              Connections → Ship Hook →
            </a>{" "}
            and this becomes a one-signature ▲ SHIP button.
          </p>
        </div>
      ) : (
        <div className="console-card p-5" data-accent="neon">
          <p className="font-body text-sm text-white/70">
            The deploy hook is connected (stored write-only). Sign to ship the current{" "}
            <span className="font-mono text-neon">main</span> to production — pushes don&apos;t
            deploy, so you stay in control.
          </p>
          <button
            onClick={ship}
            disabled={busy}
            data-accent="neon"
            className="btn-pill btn-pill--solid mt-4 text-base"
          >
            {busy ? "SIGNING…" : "▲ SHIP — DEPLOY TO PRODUCTION"}
          </button>

          {deploys.length > 0 && (
            <div className="mt-5 border-t border-edge pt-3">
              <p className="mb-2 font-pixel text-[9px] uppercase tracking-widest text-white/40">
                RECENT SHIPS · BLOCK-STAMPED
              </p>
              <div className="space-y-1">
                {deploys.map((d) => (
                  <p
                    key={`${d.ts}-${d.jobId}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-[11px] text-white/50"
                  >
                    <span>
                      ▲ shipped by <span className="text-white/70">{d.by.slice(0, 8)}…</span>
                      {d.jobId && <span className="ml-2 text-white/30">job {d.jobId.slice(0, 10)}</span>}
                    </span>
                    <span className="text-neon">{bftDateTime(d.at)}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
