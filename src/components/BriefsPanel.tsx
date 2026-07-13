"use client";

import { useCallback, useEffect, useState } from "react";
import Markdown from "@/components/Markdown";
import { bftDateTime } from "@/lib/bb/bft";

/**
 * The Briefs library — the design briefs as reviewable tickets, in TWO TIERS:
 *   • SHARED   — pulled from a PUBLIC repo via the GitHub API with no token.
 *   • PERSONAL — pulled from the PRIVATE captains-only repo with the console's
 *                connected PAT.
 * Every card carries a tier chip and the list has a SHARED · PERSONAL filter
 * (Duty-Roster style). The list is ticket cards (colour rail, status chip, tier
 * chip, title, one-line summary); selecting one opens the reader with a comment
 * box and the two review gestures: ✍ SIGN OFF (neon) and ↩ SEND BACK (cyan).
 * Each gesture signs `PACS-BRIEF-<tier>-<slug>-<ts>-<action>` with the operator
 * key — the console's signed-action model — and POSTs it to the gated API.
 *
 * ⟳ PULL BRIEFS pulls BOTH sources at once with honest per-source status. The
 * repo/branch editors now live in the Connections tab (⚙ link below); only the
 * PULL action and the sources readout stay here. Content lives only in the
 * store, never in this public repo. Types are inlined: the store is server-only.
 */

type BriefStatus = "unreviewed" | "revise" | "signed";
type BriefTier = "shared" | "personal";
interface Brief {
  slug: string;
  title: string;
  body: string;
  source?: string;
  tier: BriefTier;
  status: BriefStatus;
  comment?: string;
  at?: number;
  sig?: string;
}
interface Sources {
  shared: { repo: string; branch: string };
  personal: { repo: string; branch: string; tokenSet: boolean };
}
interface PullResult {
  ok: boolean;
  tier: BriefTier;
  reason?: string;
  detail?: string;
  repo?: string;
  branch?: string;
  count?: number;
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
const TIER_LABEL: Record<BriefTier, string> = { shared: "SHARED", personal: "PERSONAL" };
const TIER_ACCENT: Record<BriefTier, Accent> = { shared: "cyan", personal: "pink" };

type TierFilter = "all" | BriefTier;
const TIER_FILTERS: { v: TierFilter; label: string }[] = [
  { v: "all", label: "ALL" },
  { v: "shared", label: "SHARED" },
  { v: "personal", label: "PERSONAL" },
];

/** Compound key — a shared and personal brief may share a slug, so the tier is
    part of every identity (selection, drafts, React key). */
const keyOf = (b: Brief) => `${b.tier}/${b.slug}`;

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
  const [sources, setSources] = useState<Sources | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<TierFilter>("all");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"signoff" | "sendback" | "pull" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

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
        setSources(data.sources ?? null);
      } else setErr(data.reason ?? "couldn't read the library");
    } catch {
      setErr("couldn't reach the app — try again");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** ⟳ pull BOTH tiers at once — honest per-source status back in one line. */
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
      if (!data || (!data.shared && !data.personal)) {
        setErr(data?.reason ?? `couldn't pull (HTTP ${res.status})`);
        return;
      }
      const line = (r: PullResult) =>
        r.ok
          ? `${TIER_LABEL[r.tier]}: pulled ${r.count} from ${r.repo}@${r.branch}`
          : `${TIER_LABEL[r.tier]}: ${r.detail ?? r.reason ?? "couldn't pull"}`;
      const results = [data.shared, data.personal].filter(Boolean) as PullResult[];
      const good = results.filter((r) => r.ok).map(line);
      const bad = results.filter((r) => !r.ok).map(line);
      setOk(good.length ? good.join("  ·  ") : null);
      setErr(bad.length ? bad.join("  ·  ") : null);
      load();
    } catch {
      setErr("couldn't reach the server — check your connection and try again");
    } finally {
      setBusy(null);
    }
  }

  async function review(b: Brief, action: "signoff" | "sendback") {
    const k = keyOf(b);
    const comment = (drafts[k] ?? "").trim();
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
        content: `PACS-BRIEF-${b.tier}-${b.slug}-${Date.now()}-${action}${comment ? `\n${comment}` : ""}`,
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
      setOk(action === "signoff" ? `signed off — ${b.slug}` : `sent back — ${b.slug}`);
      setDrafts((p) => {
        const n = { ...p };
        delete n[k];
        return n;
      });
      load();
    } catch {
      setErr("couldn't reach the server — check your connection and try again");
    } finally {
      setBusy(null);
    }
  }

  const selectedBrief = selected ? (briefs ?? []).find((b) => keyOf(b) === selected) ?? null : null;

  // ── the reader ─────────────────────────────────────────────────────────────
  if (selectedBrief) {
    const b = selectedBrief;
    const k = keyOf(b);
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
            <span className="pill pill--muted" data-accent={TIER_ACCENT[b.tier]}>
              {TIER_LABEL[b.tier]}
            </span>
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
                value={drafts[k] ?? ""}
                onChange={(e) => setDrafts((p) => ({ ...p, [k]: e.target.value }))}
                rows={3}
                placeholder="what you think — or what to change on a send-back"
                className="mt-1 w-full rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-white/85 placeholder:text-white/25 focus:border-cyan focus:outline-none"
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => review(b, "signoff")}
                disabled={busy === "signoff" || busy === "sendback"}
                data-accent="neon"
                className="btn-pill btn-pill--solid"
              >
                {busy === "signoff" ? "SIGNING…" : "✍ SIGN OFF"}
              </button>
              <button
                onClick={() => review(b, "sendback")}
                disabled={busy === "signoff" || busy === "sendback" || !(drafts[k] ?? "").trim()}
                data-accent="cyan"
                className="btn-pill"
              >
                {busy === "sendback" ? "SENDING BACK…" : "↩ SEND BACK"}
              </button>
            </div>
            <p className="mt-2 font-mono text-[11px] text-white/40">
              your key signs the review — PACS-BRIEF-{b.tier}-{b.slug}-…
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── the library list ───────────────────────────────────────────────────────
  const all = briefs ?? [];
  const shown = all.filter((b) => filter === "all" || b.tier === filter);
  const unreviewed = shown.filter((b) => b.status === "unreviewed");
  const revise = shown.filter((b) => b.status === "revise");
  const signed = shown.filter((b) => b.status === "signed");
  const tierCount = (t: TierFilter) => (t === "all" ? all.length : all.filter((b) => b.tier === t).length);

  function card(b: Brief) {
    const accent = ACCENT[b.status];
    return (
      <button
        key={keyOf(b)}
        onClick={() => {
          setSelected(keyOf(b));
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
            <span className="pill pill--muted" data-accent={TIER_ACCENT[b.tier]}>
              {TIER_LABEL[b.tier]}
            </span>
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
        it back. Two tiers: <span className="text-cyan">SHARED</span> (a public source) and{" "}
        <span className="text-pink">PERSONAL</span> (your private captains-only source). Content stays
        private either way: it lives in the store, never in the repo.
      </p>

      {/* sources readout + the ⟳ pull. The repo/branch editors now live in the
          Connections tab — this is just the readout, the pull, and the link. */}
      <div className="console-card mb-6 p-4" data-accent="cyan">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <p className="font-pixel text-[9px] uppercase text-white/40">SOURCES · TWO TIERS</p>
            <p className="truncate font-mono text-xs text-white/75">
              <span className="text-cyan">SHARED</span> ·{" "}
              {sources ? `${sources.shared.repo}@${sources.shared.branch}` : "…"}
              <span className="ml-2 text-white/30">PUBLIC — NO TOKEN</span>
            </p>
            <p className="truncate font-mono text-xs text-white/75">
              <span className="text-pink">PERSONAL</span> ·{" "}
              {sources ? `${sources.personal.repo}@${sources.personal.branch}` : "…"}
              {sources && !sources.personal.tokenSet && (
                <span className="ml-2 text-ghost">· NO TOKEN CONNECTED</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/a/connections#briefs"
              data-accent="cyan"
              className="btn-pill btn-pill--muted inline-flex min-h-11 items-center"
            >
              ⚙ SET UP IN CONNECTIONS →
            </a>
            <button onClick={pull} disabled={busy === "pull"} data-accent="cyan" className="btn-pill">
              {busy === "pull" ? "PULLING…" : "⟳ PULL BRIEFS"}
            </button>
          </div>
        </div>
        <p className="mt-3 font-mono text-[11px] text-white/40">
          ⟳ pulls BOTH sources — shared via the public GitHub API (no key), personal via the console&apos;s
          connected PAT (Contents:read). Point the repos in{" "}
          <a href="/a/connections#briefs" className="text-cyan underline hover:text-white">
            Connections
          </a>
          ; content flows repo → store, never into git.
        </p>
      </div>

      {err && <p className="mb-4 font-pixel text-[10px] uppercase text-ghost">{err}</p>}
      {ok && <p className="mb-4 font-pixel text-[10px] uppercase text-neon">{ok}</p>}

      {!briefs ? (
        <p className="font-body text-sm text-white/50">Reading the library…</p>
      ) : briefs.length === 0 ? (
        <div className="console-card p-5 font-body text-sm text-white/60" data-accent="cyan">
          The library is empty. Hit <span className="text-cyan">⟳ PULL BRIEFS</span> to load both tiers
          — the shared public source and your private one (or run{" "}
          <span className="font-mono text-white/70">npm run sync:briefs</span> locally for personal).
          Nothing here ever touches the public repo. 🌱
        </div>
      ) : (
        <>
          {/* tier filter — Duty-Roster style segmented chips */}
          <div className="mb-5 flex flex-wrap gap-2">
            {TIER_FILTERS.map((f) => (
              <button
                key={f.v}
                onClick={() => setFilter(f.v)}
                data-accent="cyan"
                className={`btn-pill ${filter === f.v ? "btn-pill--solid" : "btn-pill--muted"}`}
                aria-pressed={filter === f.v}
              >
                {f.label} · {tierCount(f.v)}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="console-card p-5 font-body text-sm text-white/60" data-accent="cyan">
              No {filter} briefs yet. Hit <span className="text-cyan">⟳ PULL BRIEFS</span> or check the
              source in <a href="/a/connections#briefs" className="text-cyan underline">Connections</a>.
            </div>
          ) : (
            <div className="space-y-8">
              {unreviewed.length > 0 && (
                <section>
                  <p
                    className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-pink/80"
                    data-accent="pink"
                  >
                    NEEDS YOUR REVIEW · {unreviewed.length}
                  </p>
                  <div className="space-y-3">{unreviewed.map(card)}</div>
                </section>
              )}
              {revise.length > 0 && (
                <section>
                  <p
                    className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-cyan/80"
                    data-accent="cyan"
                  >
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
        </>
      )}
    </div>
  );
}
