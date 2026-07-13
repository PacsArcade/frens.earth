"use client";

import { useCallback, useEffect, useState } from "react";
import Markdown from "@/components/Markdown";
import { bftDateTime } from "@/lib/bb/bft";

/**
 * The Briefs library — the design briefs as reviewable tickets. The list is
 * Duty-Roster style ticket cards (colour rail, status chip, title, one-line
 * summary); selecting one opens the reader (markdown-rendered) with a comment
 * box and the two review gestures: ✍ SIGN OFF (neon) and ↩ SEND BACK (cyan).
 * Each gesture signs `PACS-BRIEF-<slug>-<ts>-<action>` with the operator key —
 * the console's signed-action model — and POSTs it to the gated API.
 *
 * ⟳ PULL BRIEFS fetches the private captains-only repo's *.md into the store
 * using the console's connected GitHub token. Content lives only in the store,
 * never in this public repo. Types are inlined: the store is server-only.
 */

type BriefStatus = "unreviewed" | "revise" | "signed";
interface Brief {
  slug: string;
  title: string;
  body: string;
  source?: string;
  status: BriefStatus;
  comment?: string;
  at?: number;
  sig?: string;
}
interface Source {
  repo: string;
  branch: string;
  tokenSet: boolean;
}

type Accent = "pink" | "cyan" | "neon";
const ACCENT: Record<BriefStatus, Accent> = {
  unreviewed: "pink",
  revise: "cyan",
  signed: "neon",
};
const STATUS_LABEL: Record<BriefStatus, string> = {
  unreviewed: "NEEDS REVIEW",
  revise: "SENT BACK",
  signed: "SIGNED OFF",
};

/** First meaningful line of the body → a one-line card summary. */
function summarize(body: string): string {
  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    const l = raw.trim();
    if (!l) continue;
    if (
      l.startsWith("#") ||
      l.startsWith(">") ||
      l.startsWith("```") ||
      l.startsWith("- ") ||
      l.startsWith("* ") ||
      l.startsWith("|")
    ) {
      continue;
    }
    return l.replace(/\*\*/g, "").replace(/`/g, "").replace(/\*/g, "").slice(0, 160);
  }
  return "";
}

export default function BriefsPanel() {
  const [briefs, setBriefs] = useState<Brief[] | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"signoff" | "sendback" | "pull" | "savesource" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [editSource, setEditSource] = useState(false);
  const [repoInput, setRepoInput] = useState("");
  const [branchInput, setBranchInput] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/admin/briefs");
      if (res.status === 401) {
        setBriefs([]);
        setErr("operator sign-in required");
        return;
      }
      const data = await res.json();
      if (data.ok) {
        setBriefs(data.briefs);
        setSource(data.source ?? null);
      } else setErr(data.reason ?? "couldn't read the library");
    } catch {
      setErr("couldn't reach the app — try again");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function pull() {
    setErr(null);
    setOk(null);
    setBusy("pull");
    try {
      const res = await fetch("/api/admin/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pull: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        // honest states — mirror the merge queue's "not connected" box
        setErr(
          data?.detail ??
            (data?.reason === "connect-github"
              ? "no GitHub token connected — connect the console's PAT (Contents:read on the briefs repo) in the merge queue"
              : data?.reason ?? `couldn't pull (HTTP ${res.status})`),
        );
        return;
      }
      setOk(`pulled ${data.count} brief${data.count === 1 ? "" : "s"} from ${data.repo}@${data.branch}`);
      load();
    } catch {
      setErr("couldn't reach the server — check your connection and try again");
    } finally {
      setBusy(null);
    }
  }

  async function saveSource() {
    const repo = repoInput.trim();
    const branch = branchInput.trim();
    setErr(null);
    setOk(null);
    setBusy("savesource");
    try {
      const res = await fetch("/api/admin/nodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefsRepo: repo, briefsBranch: branch }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setErr(data?.reason ?? `couldn't save the source (HTTP ${res.status})`);
        return;
      }
      setOk("briefs source updated");
      setEditSource(false);
      load();
    } catch {
      setErr("couldn't reach the server — try again");
    } finally {
      setBusy(null);
    }
  }

  async function review(slug: string, action: "signoff" | "sendback") {
    const comment = (drafts[slug] ?? "").trim();
    if (action === "sendback" && !comment) {
      setErr("write a comment first — say what to change");
      return;
    }
    if (!window.nostr?.signEvent) {
      setErr("no signer extension found — install nos2x or Alby, then try again");
      return;
    }
    setErr(null);
    setOk(null);
    setBusy(action);
    let event;
    try {
      event = await window.nostr.signEvent({
        kind: 22242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: `PACS-BRIEF-${slug}-${Date.now()}-${action}${comment ? `\n${comment}` : ""}`,
      });
    } catch {
      setErr("signing was declined — nothing sent");
      setBusy(null);
      return;
    }
    try {
      const res = await fetch("/api/admin/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review: event }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setErr(data?.reason ?? `the server hiccuped (HTTP ${res.status}) — your signature was fine`);
        return;
      }
      setOk(action === "signoff" ? `signed off — ${slug}` : `sent back — ${slug}`);
      setDrafts((p) => {
        const n = { ...p };
        delete n[slug];
        return n;
      });
      load();
    } catch {
      setErr("couldn't reach the server — check your connection and try again");
    } finally {
      setBusy(null);
    }
  }

  const selectedBrief = selected ? (briefs ?? []).find((b) => b.slug === selected) ?? null : null;

  // ── the reader ─────────────────────────────────────────────────────────────
  if (selectedBrief) {
    const b = selectedBrief;
    const accent = ACCENT[b.status];
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <button onClick={() => setSelected(null)} className="btn-pill btn-pill--muted mb-5">
          ← BACK TO LIBRARY
        </button>

        {err && <p className="mb-4 font-pixel text-[10px] uppercase text-ghost">{err}</p>}
        {ok && <p className="mb-4 font-pixel text-[10px] uppercase text-neon">{ok}</p>}

        <div className="console-card p-6" data-accent={accent}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="pill">{STATUS_LABEL[b.status]}</span>
            {b.source && (
              <span className="font-mono text-[10px] uppercase text-white/30">{b.source}</span>
            )}
            {b.at && (
              <span className="font-mono text-[10px] text-white/30">
                {b.status === "signed" ? "✓" : "↩"} {bftDateTime(b.at)}
              </span>
            )}
          </div>
          <h1 className="mt-2 font-arcade text-3xl text-cyan glow-cyan">{b.title}</h1>

          {b.comment && b.status !== "unreviewed" && (
            <p
              className={`mt-3 font-mono text-[11px] leading-relaxed ${
                b.status === "signed" ? "text-neon/85" : "text-cyan/85"
              }`}
            >
              ▸ {b.comment}
            </p>
          )}

          <article className="mt-5 border-t border-edge pt-5">
            <Markdown source={b.body} />
          </article>

          <div className="mt-6 border-t border-edge pt-4">
            <label className="block">
              <span className="font-pixel text-[9px] uppercase text-white/40">
                COMMENT — RIDES THE SIGNATURE (REQUIRED TO SEND BACK)
              </span>
              <textarea
                value={drafts[b.slug] ?? ""}
                onChange={(e) => setDrafts((p) => ({ ...p, [b.slug]: e.target.value }))}
                rows={3}
                placeholder="what you think — or what to change on a send-back"
                className="mt-1 w-full rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-white/85 placeholder:text-white/25 focus:border-cyan focus:outline-none"
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => review(b.slug, "signoff")}
                disabled={busy === "signoff" || busy === "sendback"}
                data-accent="neon"
                className="btn-pill btn-pill--solid"
              >
                {busy === "signoff" ? "SIGNING…" : "✍ SIGN OFF"}
              </button>
              <button
                onClick={() => review(b.slug, "sendback")}
                disabled={busy === "signoff" || busy === "sendback" || !(drafts[b.slug] ?? "").trim()}
                data-accent="cyan"
                className="btn-pill"
              >
                {busy === "sendback" ? "SENDING BACK…" : "↩ SEND BACK"}
              </button>
            </div>
            <p className="mt-2 font-mono text-[11px] text-white/40">
              your key signs the review — PACS-BRIEF-{b.slug}-…
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── the library list ───────────────────────────────────────────────────────
  const unreviewed = (briefs ?? []).filter((b) => b.status === "unreviewed");
  const revise = (briefs ?? []).filter((b) => b.status === "revise");
  const signed = (briefs ?? []).filter((b) => b.status === "signed");

  function card(b: Brief) {
    const accent = ACCENT[b.status];
    return (
      <button
        key={b.slug}
        onClick={() => {
          setSelected(b.slug);
          setErr(null);
          setOk(null);
        }}
        data-accent={accent}
        className="console-card console-card--hover flex w-full items-stretch gap-3 overflow-hidden text-left"
      >
        <span aria-hidden className="w-1.5 shrink-0" style={{ background: "var(--acc)" }} />
        <span className="min-w-0 flex-1 p-4">
          <span className="flex flex-wrap items-center gap-2">
            <span className="pill">{STATUS_LABEL[b.status]}</span>
            {b.source && (
              <span className="truncate font-mono text-[10px] uppercase text-white/30">{b.source}</span>
            )}
            {b.at && (
              <span className="font-mono text-[10px] text-white/30">
                {b.status === "signed" ? "✓" : "↩"} {bftDateTime(b.at)}
              </span>
            )}
          </span>
          <span className="mt-1.5 block font-pixel text-sm uppercase leading-snug text-cyan">
            {b.title}
          </span>
          <span className="mt-1 block font-body text-sm text-white/55">{summarize(b.body)}</span>
        </span>
      </button>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="lcars-eyebrow mb-3" data-accent="cyan">
        BRIEFS LIBRARY · READ · COMMENT · SIGN OFF
      </p>
      <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">BRIEFS</h1>
      <p className="mb-6 font-body text-sm text-white/55">
        The design briefs as reviewable tickets — read the brief, leave a comment, sign it off or send
        it back. Content stays private: it lives in the store, never in the repo.
      </p>

      {/* source + pull — the private captains-only repo, and the button that
          pulls it into the store using the console's connected GitHub token */}
      <div className="console-card mb-6 p-4" data-accent="cyan">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-pixel text-[9px] uppercase text-white/40">SOURCE · PRIVATE REPO</p>
            <p className="mt-1 truncate font-mono text-xs text-white/75">
              {source ? `${source.repo}@${source.branch}` : "…"}
              {source && !source.tokenSet && (
                <span className="ml-2 text-ghost">· NO TOKEN CONNECTED</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setEditSource((v) => !v);
                setRepoInput(source?.repo ?? "");
                setBranchInput(source?.branch ?? "");
              }}
              className="btn-pill btn-pill--muted"
            >
              {editSource ? "CANCEL" : "✎ SOURCE"}
            </button>
            <button
              onClick={pull}
              disabled={busy === "pull"}
              data-accent="cyan"
              className="btn-pill"
            >
              {busy === "pull" ? "PULLING…" : "⟳ PULL BRIEFS"}
            </button>
          </div>
        </div>

        {editSource && (
          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-edge pt-3">
            <label className="min-w-0 flex-1">
              <span className="font-pixel text-[9px] uppercase text-white/40">REPO (owner/name)</span>
              <input
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                placeholder="PacsArcade/frens-briefs"
                className="mt-1 w-full rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-white/85 placeholder:text-white/25 focus:border-cyan focus:outline-none"
              />
            </label>
            <label className="w-28">
              <span className="font-pixel text-[9px] uppercase text-white/40">BRANCH</span>
              <input
                value={branchInput}
                onChange={(e) => setBranchInput(e.target.value)}
                placeholder="main"
                className="mt-1 w-full rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-white/85 placeholder:text-white/25 focus:border-cyan focus:outline-none"
              />
            </label>
            <button
              onClick={saveSource}
              disabled={busy === "savesource"}
              data-accent="cyan"
              className="btn-pill btn-pill--solid"
            >
              {busy === "savesource" ? "SAVING…" : "SAVE"}
            </button>
          </div>
        )}
        <p className="mt-2 font-mono text-[11px] text-white/40">
          the pull reads *.md via the GitHub API with the console&apos;s connected PAT (Contents:read on
          this repo) — the same key the merge queue uses. Content flows repo → store, never into git.
        </p>
      </div>

      {err && <p className="mb-4 font-pixel text-[10px] uppercase text-ghost">{err}</p>}
      {ok && <p className="mb-4 font-pixel text-[10px] uppercase text-neon">{ok}</p>}

      {!briefs ? (
        <p className="font-body text-sm text-white/50">Reading the library…</p>
      ) : briefs.length === 0 ? (
        <div className="console-card p-5 font-body text-sm text-white/60" data-accent="cyan">
          The library is empty. Hit <span className="text-cyan">⟳ PULL BRIEFS</span> to load them from
          the private repo (or run <span className="font-mono text-white/70">npm run sync:briefs</span>{" "}
          locally). Nothing here ever touches the public repo. 🌱
        </div>
      ) : (
        <div className="space-y-8">
          {unreviewed.length > 0 && (
            <section>
              <p className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-pink/80" data-accent="pink">
                NEEDS YOUR REVIEW · {unreviewed.length}
              </p>
              <div className="space-y-3">{unreviewed.map(card)}</div>
            </section>
          )}
          {revise.length > 0 && (
            <section>
              <p className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-cyan/80" data-accent="cyan">
                ↩ SENT BACK · {revise.length}
              </p>
              <div className="space-y-3">{revise.map(card)}</div>
            </section>
          )}
          {signed.length > 0 && (
            <section>
              <p className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-white/40">
                ✓ SIGNED OFF · {signed.length}
              </p>
              <div className="space-y-3">{signed.map(card)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
