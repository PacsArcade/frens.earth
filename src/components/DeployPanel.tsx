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
 * Not configured → a one-time connect box (paste the deploy hook, stored
 * write-only). Configured → the ▲ SHIP button + a recent-ships list.
 *
 * Accent: neon = live/ship. NOT coin — gold is money only (house color law).
 */

interface DeployRecord {
  by: string; // signer pubkey hex
  at: number; // BFT block height
  jobId: string;
  ts: number;
}

export default function DeployPanel() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [deploys, setDeploys] = useState<DeployRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/admin/deploy");
      if (res.status === 401) {
        setConfigured(false);
        setErr("operator sign-in required");
        return;
      }
      const data = await res.json();
      if (!data.ok) {
        setErr(data.reason ?? "couldn't read the ship log");
        return;
      }
      setConfigured(!!data.configured);
      setDeploys(Array.isArray(data.deploys) ? data.deploys : []);
    } catch {
      setErr("couldn't reach the app — try again");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      load();
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
      {err && <p className="mb-3 font-pixel text-[10px] uppercase text-ghost">{err}</p>}
      {note && <p className="mb-3 font-pixel text-[10px] uppercase text-neon">{note}</p>}

      {configured === null ? (
        <p className="font-body text-sm text-white/50">Reading the ship log…</p>
      ) : !configured ? (
        <ConnectDeployHook onConnected={load} />
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

/** The one-time connect box — paste the Vercel Deploy Hook URL, stored
    write-only (masked forever after, like the GitHub token). The copy walks
    the admiral through the one-time Vercel setup so pushes never auto-deploy —
    the signature is the only door to production. */
function ConnectDeployHook({ onConnected }: { onConnected: () => void }) {
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
    <div className="console-card p-4" data-accent="neon">
      <p className="mb-2 font-pixel text-[10px] uppercase text-neon">
        CONNECT THE DEPLOY HOOK — ONE-TIME SETUP
      </p>
      <p className="mb-3 font-body text-xs leading-relaxed text-white/70">
        Vercel → <span className="text-neon">frens-earth</span> → Settings → Git: connect this repo,
        then turn <span className="text-neon">OFF</span> automatic production deployments (pushes
        won&apos;t deploy — you stay in control). Settings → Git → Deploy Hooks: create one for
        branch <span className="font-mono text-neon">main</span>, copy the URL, paste it here. It&apos;s
        stored write-only and never shown again.
      </p>
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
          {busy ? "SAVING…" : "▶ CONNECT"}
        </button>
      </div>
      {err && <p className="mt-2 font-pixel text-[9px] uppercase text-ghost">{err}</p>}
    </div>
  );
}
