"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The merge queue — SCAR's authorize-with-key lane. Each open PR gets one
 * button: sign `PACS-MERGE-<pr>-<headSha>-<ts>` with the operator key. The
 * signature binds the exact commit (a moved branch voids it), is verified
 * against the allowlist server-side, recorded as the audit trail, and — when
 * the deployment has a GITHUB_TOKEN — executes the merge right here.
 */

interface OpenPr {
  number: number;
  title: string;
  branch: string;
  headSha: string;
  url: string;
  draft: boolean;
}
interface MergeAuth {
  pr: number;
  headSha: string;
  by: string;
  at: string;
  merged: boolean;
  mergeNote?: string;
}

export default function MergeQueue() {
  const [prs, setPrs] = useState<OpenPr[] | null>(null);
  const [auths, setAuths] = useState<MergeAuth[]>([]);
  const [canExecute, setCanExecute] = useState(false);
  const [setup, setSetup] = useState<string | null>(null);
  const [busyPr, setBusyPr] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/admin/merges");
      const data = await res.json();
      if (!data.ok) {
        setErr(data.reason ?? "couldn't read the queue");
        return;
      }
      setPrs(data.prs);
      setAuths(data.auths);
      setCanExecute(data.canExecute);
      setSetup(data.setup ?? null);
    } catch {
      setErr("couldn't reach the app — try again");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function authorize(pr: OpenPr) {
    setErr(null);
    setNote(null);
    if (!window.nostr?.signEvent) {
      setErr("no signer extension found — the authorization is your signature");
      return;
    }
    setBusyPr(pr.number);
    let event;
    try {
      event = await window.nostr.signEvent({
        kind: 22242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: `PACS-MERGE-${pr.number}-${pr.headSha}-${Date.now()}`,
      });
    } catch {
      setErr("signing was declined — nothing sent");
      setBusyPr(null);
      return;
    }
    try {
      const res = await fetch("/api/admin/merges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setErr(data?.reason ?? `the server hiccuped (HTTP ${res.status}) — your signature was fine`);
        return;
      }
      setNote(`PR #${data.pr}: ${data.note}`);
      load();
    } catch {
      setErr("couldn't reach the server — check your connection and try again");
    } finally {
      setBusyPr(null);
    }
  }

  const authFor = (pr: OpenPr) => auths.filter((a) => a.pr === pr.number).at(-1);

  return (
    <div className="mx-auto mb-10 max-w-3xl px-6">
      <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
        SCAR ▸ MERGE QUEUE — YOUR SIGNATURE IS THE AUTHORIZATION
      </p>
      {err && <p className="mb-3 font-pixel text-[10px] uppercase text-ghost">{err}</p>}
      {note && <p className="mb-3 font-pixel text-[10px] uppercase text-neon">{note}</p>}
      {!prs ? (
        <p className="font-body text-sm text-white/50">Reading the queue…</p>
      ) : setup ? (
        <div className="border-2 border-coin/60 bg-coin/5 p-4">
          <p className="mb-1 font-pixel text-[10px] uppercase text-coin">CONNECT YOUR GITHUB</p>
          <p className="font-body text-sm text-white/80">{setup}</p>
        </div>
      ) : prs.length === 0 ? (
        <p className="border-2 border-edge bg-panel p-4 font-body text-sm text-white/60">
          Nothing waiting to merge — the board is clean. 🌱
        </p>
      ) : (
        <div className="space-y-2">
          {prs.map((pr) => {
            const a = authFor(pr);
            return (
              <div key={pr.number} className="border-2 border-edge bg-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-white/40">
                      #{pr.number} · {pr.branch} · {pr.headSha.slice(0, 7)}
                      {pr.draft && <span className="ml-2 text-coin">DRAFT</span>}
                    </p>
                    <p className="mt-1 font-body text-sm text-white/90">{pr.title}</p>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border-2 border-edge px-3 py-1.5 font-pixel text-[9px] uppercase text-white/60 hover:text-white/90"
                    >
                      GITHUB ▸
                    </a>
                    <button
                      onClick={() => authorize(pr)}
                      disabled={busyPr === pr.number}
                      className="border-2 border-coin px-3 py-1.5 font-pixel text-[9px] uppercase text-coin hover:glow-coin disabled:opacity-50"
                    >
                      {busyPr === pr.number
                        ? "SIGNING…"
                        : canExecute
                          ? "✍ AUTHORIZE & MERGE"
                          : "✍ AUTHORIZE"}
                    </button>
                  </div>
                </div>
                {a && (
                  <p className="mt-2 font-mono text-[10px] text-neon">
                    ✓ authorized by {a.by.slice(0, 8)}… · {a.merged ? "merged" : a.mergeNote}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!canExecute && prs && prs.length > 0 && (
        <p className="mt-2 font-body text-xs text-white/40">
          Signatures are recorded as the sign-off; set <span className="font-mono">GITHUB_TOKEN</span>{" "}
          in the deployment env and the button merges right here.
        </p>
      )}
    </div>
  );
}
