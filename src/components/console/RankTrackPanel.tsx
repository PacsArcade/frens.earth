"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BLOCKS_PER_MONTH } from "@/lib/bb/bft";

/**
 * RANK TRACK — the lost trio's board berth (rank / points / commendations),
 * restored on the crew board. Every number is a REAL read from
 * /api/admin/rank (registry claim → Bitcoin-time tenure → the SCAR fleet
 * ladder; resolutions and commendations from the duty roster's own board).
 * Ranks are honor-only and never authorize spend, so nothing here wears
 * coin gold — the track is pink (flair), live bits neon.
 */

interface RankRead {
  ok: boolean;
  tag: string | null;
  office: string | null;
  officeTag: string | null;
  rank: { grade: string; name: string; abbrev: string; tier: string; draft: boolean } | null;
  next: { grade: string; name: string } | null;
  blocksSinceClaim: number | null;
  months: number | null;
  tipEstimated: boolean;
  points: number;
  commendations: { who: string; n: number; you: boolean }[];
}

export default function RankTrackPanel() {
  const [read, setRead] = useState<RankRead | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/rank")
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return;
        if (data?.ok) setRead(data);
        else setErr(true);
      })
      .catch(() => {
        if (alive) setErr(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  /* progress into the current BFT month — the block walks the bar */
  const monthPct =
    read?.blocksSinceClaim != null
      ? Math.round(((read.blocksSinceClaim % BLOCKS_PER_MONTH) / BLOCKS_PER_MONTH) * 100)
      : 0;
  const tilde = read?.tipEstimated ? "~" : "";

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="lcars-eyebrow mb-3" data-accent="pink">
        RANK TRACK · COMMENDATIONS — HONOR ONLY, NEVER SPEND
      </p>
      <p className="mb-5 font-body text-sm text-white/55">
        The SCAR fleet ladder walks on <b className="text-white/75">Bitcoin time</b> — tenure in
        blocks since your tag claim, certs to open the officer track. Every count below is the
        board&apos;s own; nothing is invented.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* ── YOUR RANK TRACK ──────────────────────────────────────────── */}
        <div className="console-card p-5" data-accent="pink">
          <p className="font-pixel text-[10px] uppercase tracking-widest text-white/40">
            Your rank track
          </p>
          {!read && !err && <p className="mt-3 font-body text-sm text-white/50">Reading the ladder…</p>}
          {err && (
            <p className="mt-3 font-body text-sm text-white/50">
              The ladder didn&apos;t answer — sign in again and reload.
            </p>
          )}
          {read && !read.tag && (
            /* honest empty state — no tag, no invented rank */
            <div className="mt-3">
              <p className="font-body text-sm text-white/60">
                This key holds no tag on this ship yet. The ladder starts at the claim — every
                fren is enlisted the block their tag lands.
              </p>
              <Link href="/" className="btn-pill mt-4" data-accent="pink">
                Claim your @tag
              </Link>
            </div>
          )}
          {read && read.tag && read.rank && (
            <div className="mt-2">
              <p className="font-arcade text-2xl leading-tight text-pink">{read.rank.name}</p>
              <p className="mt-1 font-mono text-[11px] text-white/50">
                {read.rank.grade} · {read.rank.abbrev} · {read.tag}
                {read.rank.draft && (
                  <span className="text-white/30"> · name is draft — GLYPH&apos;s canvas</span>
                )}
              </p>
              {read.office && (
                <p className="mt-2">
                  <span className="pill" data-accent="pink">
                    {read.office}
                  </span>{" "}
                  <span className="font-mono text-[11px] text-white/50">{read.officeTag}</span>
                </p>
              )}
              {read.blocksSinceClaim != null ? (
                <div className="mt-4">
                  <div
                    className="relative h-3.5 overflow-hidden rounded-full border-2 border-edge bg-void"
                    role="img"
                    aria-label={`${monthPct}% through the current BFT month`}
                  >
                    <div
                      className="h-full bg-pink"
                      style={{ width: `${Math.max(2, monthPct)}%` }}
                    />
                    {/* the v2 meters' segmented texture — same notched read */}
                    <span className="scar-meter-notches" aria-hidden="true" />
                  </div>
                  <p className="mt-2 font-mono text-[11px] text-white/50">
                    {tilde}
                    {read.blocksSinceClaim.toLocaleString()} blocks on the board ·{" "}
                    {tilde}
                    {read.months} BFT month{read.months === 1 ? "" : "s"}
                  </p>
                </div>
              ) : (
                <p className="mt-3 font-mono text-[11px] text-white/40">
                  claim block unknown (pre-R2 tag) — tenure starts counting when the profile
                  backfills it
                </p>
              )}
              <p className="mt-3 font-mono text-[11px] text-white/50">
                resolutions logged: <b className="text-neon">{read.points}</b>
              </p>
              {read.next && (
                <p className="mt-1 font-mono text-[11px] text-white/40">
                  next: {read.next.name} ({read.next.grade}) — certs open the officer ladder,
                  tenure walks the hall
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── COMMENDATIONS ────────────────────────────────────────────── */}
        <div className="console-card p-5" data-accent="cyan">
          <p className="font-pixel text-[10px] uppercase tracking-widest text-white/40">
            Commendations · the crew board
          </p>
          {!read && !err && <p className="mt-3 font-body text-sm text-white/50">Reading the board…</p>}
          {read && read.commendations.length === 0 && (
            <p className="mt-3 font-body text-sm text-white/60">
              No commendations logged yet — resolutions on the duty roster earn them. The first
              resolved ticket starts the board.
            </p>
          )}
          {read && read.commendations.length > 0 && (
            <ol className="mt-3 space-y-1.5">
              {read.commendations.map((c, i) => (
                <li
                  key={c.who}
                  className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${
                    c.you ? "bg-pink/10" : ""
                  }`}
                >
                  <span className="w-5 shrink-0 font-mono text-[11px] text-white/35">
                    {i + 1}.
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-cyan">
                    {c.who}
                    {c.you && <span className="text-white/40"> · you</span>}
                  </span>
                  <span className="font-arcade text-base text-neon">{c.n}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-4 border-t border-edge pt-3 font-mono text-[10.5px] leading-relaxed text-white/35">
            crew:xxxxxxxx is a key prefix, not a name — npub is plumbing; the tag lands when the
            crew member links theirs. Counts come straight off resolved tickets.
          </p>
        </div>
      </div>
    </div>
  );
}
