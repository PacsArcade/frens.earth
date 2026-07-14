"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { SEED_FLIGHT, type FlightPrio } from "@/lib/status-flight";
import { ScarConsole, type ReaderContent } from "@/components/console/ReaderDrawer";

/**
 * STATUS REPORTS — where everything stands, the moment you land. One board,
 * four gesture buckets, all REAL reads from the console's own stores:
 *   • IN FLIGHT — the committed now/next/later work (src/lib/status-flight).
 *   • SIGN     — the open cross-project sign-offs (their board: Action Items).
 *   • REVIEW   — the briefs awaiting review (their board: the Briefs library).
 *   • VOTE     — the open decisions (their board: the decision board).
 * The STAT CARDS up top ARE the filters — one taxonomy, the counts match the
 * list — and they mirror the ribbon's level-2 filter rail through the URL
 * hash. Selecting a row opens the READER DRAWER (closed by default, expand-
 * full, ✕); each report's own gesture rides its row and routes to the board
 * that owns the act. Colour law: no gold here — sign is pink (your action),
 * live is neon, info is cyan.
 */

type Bucket = "flight" | "sign" | "review" | "vote";
type Tone = "neon" | "cyan" | "pink" | "ghost";

const BUCKETS: Bucket[] = ["flight", "sign", "review", "vote"];
const BUCKET_META: Record<
  Bucket,
  { label: string; sub: string; accent: Tone; grp: string }
> = {
  flight: { label: "In flight", sub: "now / next / later", accent: "neon", grp: "In flight · the work moving now" },
  sign: { label: "Sign", sub: "your key clears", accent: "pink", grp: "Sign · your key clears these" },
  review: { label: "Review", sub: "read then rule", accent: "cyan", grp: "Review · read then rule" },
  vote: { label: "Vote", sub: "pick the option", accent: "cyan", grp: "Vote · pick the option" },
};

const PRIO_LABEL: Record<FlightPrio, string> = { now: "NOW", next: "NEXT", later: "LATER" };

interface Row {
  key: string;
  bucket: Bucket;
  accent: Tone;
  code: string;
  title: string;
  meta: string;
  prio?: FlightPrio;
  detail: string[];
  /** the report's own gesture — routes to the board that owns the act */
  gesture?: { label: string; href: string };
}

/* inlined store shapes (the stores are server-only modules) */
interface ApiSignoff {
  id: string;
  project: string;
  title: string;
  sum: string;
  tone: Tone;
  status: "open" | "signed";
  detail: string[];
}
interface ApiDecision {
  id: string;
  question: string;
  context: string;
  options: { key: string; label: string }[];
  recommendation: string;
  recommendationWhy: string;
  status: string;
  source?: string;
}
interface ApiBrief {
  slug: string;
  title: string;
  body: string;
  tier: "shared" | "personal";
  status: string;
}

/** first meaningful line of a brief body — the row's one-liner */
function firstLine(body: string): string {
  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    const l = raw.trim();
    if (!l || /^[#>`|*-]/.test(l)) continue;
    return l.replace(/[*`]/g, "").slice(0, 200);
  }
  return "";
}

export default function StatusReportsPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<Bucket | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  /* the URL hash IS the filter — the ribbon's level-2 rail and the stat cards
     stay in agreement through it */
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.replace("#", "") as Bucket;
      setFilter(BUCKETS.includes(h) ? h : null);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const toggle = useCallback(
    (b: Bucket | null) => {
      const next = b !== null && filter !== b ? b : null;
      setFilter(next);
      history.replaceState(
        null,
        "",
        next ? `#${next}` : window.location.pathname + window.location.search
      );
      // replaceState doesn't fire hashchange — nudge the ribbon by hand
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    },
    [filter]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const grab = async (url: string) => {
        try {
          const res = await fetch(url);
          if (res.status === 401) throw new Error("401");
          return await res.json();
        } catch (e) {
          if (e instanceof Error && e.message === "401") throw e;
          return null;
        }
      };
      try {
        const [so, de, br] = await Promise.all([
          grab("/api/admin/signoffs"),
          grab("/api/admin/decisions"),
          grab("/api/admin/briefs"),
        ]);
        if (!alive) return;
        const built: Row[] = [];
        for (const f of SEED_FLIGHT) {
          built.push({
            key: `flight/${f.key}`,
            bucket: "flight",
            accent: f.prio === "now" ? "neon" : "cyan",
            code: `IN FLIGHT · ${PRIO_LABEL[f.prio]}`,
            title: f.title,
            meta: f.meta,
            prio: f.prio,
            detail: f.detail,
          });
        }
        for (const s of ((so?.signoffs ?? []) as ApiSignoff[]).filter((x) => x.status === "open")) {
          built.push({
            key: `sign/${s.id}`,
            bucket: "sign",
            accent: s.tone,
            code: `${s.id} · ${s.project}`,
            title: s.title,
            meta: `${s.id} · ${s.project}`,
            detail: [s.sum, ...s.detail],
            gesture: { label: "Open on the board", href: "/a/action#signoffs" },
          });
        }
        for (const b of ((br?.briefs ?? []) as ApiBrief[]).filter((x) => x.status === "unreviewed")) {
          built.push({
            key: `review/${b.tier}/${b.slug}`,
            bucket: "review",
            accent: "pink",
            code: `BRIEF · ${b.tier.toUpperCase()}`,
            title: b.title,
            meta: `${b.tier} · ${b.slug}`,
            detail: [firstLine(b.body) || "Open the reader for the full brief."],
            gesture: { label: "Open the reader", href: `/a/briefs#${b.tier}` },
          });
        }
        for (const d of ((de?.decisions ?? []) as ApiDecision[]).filter((x) => x.status === "open")) {
          const rec = d.options.find((o) => o.key === d.recommendation);
          built.push({
            key: `vote/${d.id}`,
            bucket: "vote",
            accent: "cyan",
            code: `DECISION · ${d.source ?? d.id}`,
            title: d.question,
            meta: `✦ Number One recommends “${rec?.label ?? d.recommendation}”`,
            detail: [d.context, `✦ Recommended — ${rec?.label ?? d.recommendation}: ${d.recommendationWhy}`],
            gesture: { label: "Record ruling", href: "/a/action#decisions" },
          });
        }
        setRows(built);
      } catch {
        if (alive) {
          setRows([]);
          setErr("operator sign-in required");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const all = rows ?? [];
  const count = (b: Bucket) => all.filter((r) => r.bucket === b).length;
  const shownBuckets = filter ? [filter] : BUCKETS;
  const current = selected ? all.find((r) => r.key === selected) ?? null : null;

  const reader: ReaderContent | null = current
    ? {
        accent: current.accent,
        code: current.code,
        title: current.title,
        chips: (
          <>
            <span className="pill" data-accent={BUCKET_META[current.bucket].accent}>
              {BUCKET_META[current.bucket].label}
            </span>
            {current.prio && (
              <span
                className="pill min-w-16 justify-center"
                data-accent={current.prio === "now" ? "neon" : "cyan"}
              >
                {PRIO_LABEL[current.prio]}
              </span>
            )}
          </>
        ),
        meta: <span>{current.meta}</span>,
        body: (
          <div>
            {current.detail.map((p, i) => (
              <p key={i} className="mt-2 font-body text-sm leading-relaxed text-white/65 first:mt-0">
                {p}
              </p>
            ))}
            {current.gesture && (
              <div className="mt-4 border-t border-edge pt-4">
                <Link
                  href={current.gesture.href}
                  data-accent={current.accent}
                  className="btn-pill btn-pill--solid"
                >
                  {current.gesture.label} →
                </Link>
                <p className="mt-2 font-mono text-[11px] text-white/40">
                  the act itself lives on its own board — this opens it
                </p>
              </div>
            )}
          </div>
        ),
      }
    : null;

  function row(r: Row): ReactNode {
    return (
      <div
        key={r.key}
        data-accent={r.accent}
        className={`console-card console-card--hover flex items-center gap-2 overflow-hidden ${
          selected === r.key ? "console-card--active" : ""
        }`}
      >
        <span aria-hidden className="w-1.5 shrink-0 self-stretch" style={{ background: "var(--acc)" }} />
        <button
          onClick={() => setSelected(r.key)}
          className="min-w-0 flex-1 py-3 pl-1.5 pr-2 text-left"
        >
          <span className="flex flex-wrap items-center gap-2">
            {r.prio && (
              /* uniform priority pills — same min-width, centred */
              <span
                className="pill min-w-16 justify-center"
                data-accent={r.prio === "now" ? "neon" : "cyan"}
              >
                {PRIO_LABEL[r.prio]}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block font-pixel text-xs uppercase leading-snug text-white/90">
                {r.title}
              </span>
              <span className="mt-0.5 block truncate font-mono text-[10.5px] text-white/40">
                {r.meta}
              </span>
            </span>
          </span>
        </button>
        {r.gesture && (
          <Link
            href={r.gesture.href}
            data-accent={r.accent}
            className="btn-pill mr-3 hidden shrink-0 sm:inline-flex"
          >
            {r.gesture.label}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 pb-10">
      {err && <p className="mb-4 font-pixel text-[10px] uppercase text-ghost">{err}</p>}

      {/* the stat cards ARE the filters — one taxonomy, counts match the list */}
      <section className="scar-stats" aria-label="filter the reports by gesture">
        {BUCKETS.map((b) => (
          <button
            key={b}
            className="scar-stat"
            data-accent={BUCKET_META[b].accent}
            aria-pressed={filter === b}
            onClick={() => toggle(b)}
          >
            <div className="scar-stat__n">{rows ? count(b) : "…"}</div>
            <div className="scar-stat__l">{BUCKET_META[b].label}</div>
            <div className="scar-stat__sub">{BUCKET_META[b].sub}</div>
          </button>
        ))}
      </section>

      <div className="mb-4 mt-6 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-pixel text-xs uppercase text-white/60">
          Status Reports
          {filter && (
            <button
              onClick={() => toggle(null)}
              className="ml-3 font-mono text-[10px] normal-case text-ghost underline decoration-ghost/40 underline-offset-2 hover:decoration-ghost"
            >
              × show all
            </button>
          )}
        </h2>
        <span className="font-mono text-[10px] uppercase text-white/30">
          the cards above filter this list · needs-you on top
        </span>
      </div>

      <ScarConsole reader={reader} onClose={() => setSelected(null)}>
        {!rows ? (
          <p className="font-body text-sm text-white/50">Reading the boards…</p>
        ) : (
          <div className="space-y-7">
            {shownBuckets.map((b) => {
              const bucketRows = all.filter((r) => r.bucket === b);
              if (bucketRows.length === 0) return null;
              return (
                <section key={b} aria-label={BUCKET_META[b].label}>
                  <p
                    className="lcars-eyebrow mb-3"
                    data-accent={BUCKET_META[b].accent}
                  >
                    {BUCKET_META[b].grp}{" "}
                    <span className="normal-case tracking-normal text-white/35">
                      · {bucketRows.length}
                    </span>
                  </p>
                  <div className="space-y-2.5">{bucketRows.map(row)}</div>
                </section>
              );
            })}
            {all.length === 0 && (
              <p className="console-card p-4 font-body text-sm text-white/60">
                The board is clear — nothing in flight, nothing waiting on you. 🌱
              </p>
            )}
          </div>
        )}
      </ScarConsole>
    </div>
  );
}
