"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

/**
 * BRIEFS — the connection card for the briefs library's TWO sources, moved out
 * of the Briefs page and consolidated here with the rest of this deployment's
 * connections. Same POINT · SAVE rail as the node panels; honest fallbacks.
 *
 *   • SHARED   — a PUBLIC repo, pulled with NO token (public read).
 *   • PERSONAL — the PRIVATE captains-only repo. It has its OWN dedicated,
 *                write-only briefs token field here (an obvious place to paste a
 *                briefs-scoped key, with its own 90-day renewal). If that's
 *                unset the pull falls back to the shared Merge-Queue GitHub PAT,
 *                which we link to — never duplicate.
 *
 * The ⟳ PULL action stays on the Briefs page; this card is just the repo/branch
 * editors + honest state. Brief CONTENT never lands in this public repo either
 * way — the pull writes it straight into the gitignored/blob store.
 */

interface NodesConfig {
  briefsRepo: string;
  briefsBranch: string;
  sharedBriefsRepo: string;
  sharedBriefsBranch: string;
  briefsTokenSet: boolean;
  githubTokenSet: boolean;
}

const DEFAULTS = {
  shared: { repo: "PacsArcade/frens-briefs-public", branch: "main" },
  personal: { repo: "PacsArcade/frens-briefs", branch: "main" },
};

export default function BriefsConnectPanel() {
  const [config, setConfig] = useState<NodesConfig | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/admin/nodes");
      if (res.status === 401) {
        setErr("operator sign-in required");
        return;
      }
      const data = await res.json();
      if (data.ok) setConfig(data.config);
      else setErr(data.reason ?? "couldn't read the config");
    } catch {
      setErr("couldn't reach the app — try again");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <p className="lcars-eyebrow mb-3" data-accent="cyan">
        OPERATOR CONSOLE · FRENS.EARTH
      </p>
      <h2 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">BRIEFS</h2>
      <p className="mb-8 font-mono text-[11px] text-white/50">
        THE TWO SOURCES · POINT — SAVE · PULL FROM THE BRIEFS PAGE
      </p>

      {err && <p className="mb-4 font-pixel text-[10px] uppercase text-ghost">{err}</p>}

      <div className="max-w-2xl space-y-6">
        <SourceBox
          title="SHARED SOURCE — PUBLIC REPO · NO TOKEN"
          tone="cyan"
          repoLabel="REPO (owner/name) — PUBLIC"
          defaults={DEFAULTS.shared}
          repo={config?.sharedBriefsRepo ?? ""}
          branch={config?.sharedBriefsBranch ?? ""}
          fields={{ repo: "sharedBriefsRepo", branch: "sharedBriefsBranch" }}
          onSaved={load}
          note="Pulled with NO token — public read, so a captain needs no key for these. Honest empty / not-found state on the Briefs page until this repo exists."
        />

        <SourceBox
          title="PERSONAL SOURCE — PRIVATE REPO · TOKEN REQUIRED"
          tone="pink"
          repoLabel="REPO (owner/name) — PRIVATE"
          defaults={DEFAULTS.personal}
          repo={config?.briefsRepo ?? ""}
          branch={config?.briefsBranch ?? ""}
          fields={{ repo: "briefsRepo", branch: "briefsBranch" }}
          onSaved={load}
          note="Read with the dedicated briefs token below if set, else the merge queue's connected PAT (needs Contents:read on this repo either way)."
          extra={
            <div className="mt-3 space-y-3 border-t border-edge pt-3">
              <BriefsTokenField tokenSet={config?.briefsTokenSet ?? false} onSaved={load} />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-edge pt-3 font-mono text-[11px]">
                <span className="text-white/40">FALLBACK · MERGE-QUEUE PAT</span>
                {config?.githubTokenSet ? (
                  <span className="text-neon">✓ CONNECTED</span>
                ) : (
                  <span className="text-ghost">NOT CONNECTED</span>
                )}
                <a href="/a/action#approvals" className="text-cyan underline hover:text-white">
                  {config?.githubTokenSet
                    ? "manage the key in the merge queue →"
                    : "connect the GitHub PAT in the merge queue →"}
                </a>
              </div>
            </div>
          }
        />

        <p className="text-center font-mono text-[11px] text-white/40">
          THE ⟳ PULL LIVES ON THE{" "}
          <a href="/a/briefs" className="text-cyan underline hover:text-white">
            BRIEFS PAGE →
          </a>{" "}
          — IT PULLS BOTH SOURCES AT ONCE. CONTENT FLOWS REPO → STORE, NEVER INTO GIT.
        </p>
      </div>
    </div>
  );
}

/** One source's POINT · SAVE box — repo + branch, saved write-through to the
    node config. Empty falls back to the house default (shown, honestly).
    `tone` is the box's semantic accent (cyan = info/systems, pink = personal
    flair) — the SAVE wears it too. Never coin: gold = money only. */
function SourceBox({
  title,
  tone,
  repoLabel,
  defaults,
  repo,
  branch,
  fields,
  onSaved,
  note,
  extra,
}: {
  title: string;
  tone: "cyan" | "pink";
  repoLabel: string;
  defaults: { repo: string; branch: string };
  repo: string;
  branch: string;
  fields: { repo: string; branch: string };
  onSaved: () => void;
  note: string;
  extra?: ReactNode;
}) {
  const [repoInput, setRepoInput] = useState(repo);
  const [branchInput, setBranchInput] = useState(branch);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setRepoInput(repo);
  }, [repo]);
  useEffect(() => {
    setBranchInput(branch);
  }, [branch]);

  async function save() {
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/nodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [fields.repo]: repoInput.trim(), [fields.branch]: branchInput.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setErr(data?.reason ?? "couldn't save — try again");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } catch {
      setErr("save hiccuped — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="console-card p-4" data-accent={tone}>
      <p className={`mb-3 font-pixel text-[10px] uppercase tracking-widest ${tone === "pink" ? "text-pink" : "text-cyan"}`}>
        {title}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="font-pixel text-[9px] uppercase text-white/40">{repoLabel}</span>
          <input
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder={defaults.repo}
            className="mt-1 w-full rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-cyan placeholder:text-white/25 focus:border-cyan focus:outline-none"
          />
        </label>
        <label className="w-28">
          <span className="font-pixel text-[9px] uppercase text-white/40">BRANCH</span>
          <input
            value={branchInput}
            onChange={(e) => setBranchInput(e.target.value)}
            placeholder={defaults.branch}
            className="mt-1 w-full rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-cyan placeholder:text-white/25 focus:border-cyan focus:outline-none"
          />
        </label>
        <button
          onClick={save}
          disabled={saving}
          data-accent={tone}
          className="btn-pill btn-pill--solid"
        >
          {saving ? "SAVING…" : saved ? "✓ SAVED" : "SAVE"}
        </button>
      </div>
      <p className="mt-2 font-body text-xs text-white/50">
        Empty falls back to{" "}
        <span className="font-mono text-white/70">
          {defaults.repo}@{defaults.branch}
        </span>
        . {note}
      </p>
      {extra}
      {err && <p className="mt-2 font-pixel text-[9px] uppercase text-ghost">{err}</p>}
    </div>
  );
}

/** The PERSONAL briefs token — its OWN dedicated place to enter a briefs-scoped
    key (the admiral kept hunting for one). Write-only, mirroring the merge
    token / deploy hook: we POST it and never read it back, so the UI only ever
    knows SET / NOT SET — the value is never echoed. Same POINT · SAVE rail as
    the repo boxes; no hardcoded hex. */
function BriefsTokenField({ tokenSet, onSaved }: { tokenSet: boolean; onSaved: () => void }) {
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    if (!token.trim()) {
      setErr("paste a token first");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/nodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefsToken: token.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setErr(data?.reason ?? "couldn't save — try again");
        return;
      }
      setToken(""); // never keep the secret in state after it's stored
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } catch {
      setErr("save hiccuped — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
        <span className="text-white/40">PERSONAL BRIEFS TOKEN</span>
        {tokenSet ? <span className="text-neon">SET ✓</span> : <span className="text-ghost">NOT SET</span>}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="font-pixel text-[9px] uppercase text-white/40">
            {tokenSet ? "PASTE TO REPLACE" : "PASTE TO SET"}
          </span>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            type="password"
            placeholder="github_pat_…"
            disabled={saving}
            className="mt-1 w-full rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-cyan placeholder:text-white/25 focus:border-cyan focus:outline-none disabled:opacity-50"
          />
        </label>
        <button
          onClick={save}
          disabled={saving}
          data-accent="pink"
          className="btn-pill btn-pill--solid"
        >
          {saving ? "SAVING…" : saved ? "✓ SAVED" : "POINT · SAVE"}
        </button>
      </div>
      <p className="mt-2 font-body text-xs text-white/50">
        Fine-grained PAT with <span className="font-mono text-white/70">frens-briefs</span> → Contents:
        read. Stored write-only — never shown again. Empty falls back to the merge-queue PAT below.
      </p>
      {err && <p className="mt-2 font-pixel text-[9px] uppercase text-ghost">{err}</p>}
    </div>
  );
}
