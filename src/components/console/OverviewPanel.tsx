"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { currentBlockInfo } from "@/lib/bb/bft";
import { CONSOLE_SITE } from "@/lib/console";

/**
 * The SCAR·LET OVERVIEW — the console front page (the room the ◗ SCAR·LET
 * brand block opens). Three honest reads, no invented numbers:
 *   • SITE HEALTH — the console serving, the live chain tip (★-box height
 *     through the fleet's own door, ~ when estimated), and the nodes wired
 *     out of the four doors (spaces · chat · mud · chain).
 *   • NEEDS YOU — the real board counts (sign-offs, decisions, briefs,
 *     tickets), each stat card a door into its room. People-and-work counts
 *     only — coin stays money-only, so nothing here wears gold.
 *   • FIRST CAPTAINS — where a new operator begins, four steps with ONE
 *     uniform button size.
 */

const NODE_DOORS = [
  { key: "spaces", label: "SPACES", api: "/api/admin/spaces/status" },
  { key: "chat", label: "CHAT", api: "/api/admin/chat/status" },
  { key: "mud", label: "MUD", api: "/api/admin/mud/status" },
  { key: "chain", label: "CHAIN", api: "/api/admin/mempool/status" },
] as const;

interface Counts {
  signoffs?: number;
  decisions?: number;
  review?: number;
  tickets?: number;
}

export default function OverviewPanel() {
  const [tip, setTip] = useState<{ height: number; estimated: boolean } | null>(null);
  const [wired, setWired] = useState<{ up: number; dark: string[] } | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    let alive = true;
    currentBlockInfo().then((i) => {
      if (alive) setTip(i);
    });
    // the four doors — reachable counts as wired; anything else is honest-dark
    Promise.all(
      NODE_DOORS.map(async (d) => {
        try {
          const res = await fetch(d.api);
          const data = await res.json().catch(() => null);
          return { label: d.label, up: data?.reachable === true };
        } catch {
          return { label: d.label, up: false };
        }
      })
    ).then((doors) => {
      if (!alive) return;
      setWired({
        up: doors.filter((d) => d.up).length,
        dark: doors.filter((d) => !d.up).map((d) => d.label),
      });
    });
    fetch("/api/admin/counts")
      .then((res) => res.json())
      .then((data) => {
        if (alive && data?.ok) setCounts(data.counts);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const n = (v: number | undefined) => (v === undefined ? "…" : String(v));
  const needsYou =
    counts && counts.signoffs !== undefined
      ? (counts.signoffs ?? 0) + (counts.decisions ?? 0) + (counts.review ?? 0)
      : undefined;

  const grp = (accent: string, label: string, sub: string) => (
    <p
      className="lcars-eyebrow mb-3 mt-8 first:mt-0"
      data-accent={accent}
    >
      {label} <span className="normal-case tracking-normal text-white/35">· {sub}</span>
    </p>
  );

  return (
    <div className="mx-auto max-w-5xl px-6 pb-10">
      {grp("neon", `SITE HEALTH · ${CONSOLE_SITE.domain.toUpperCase()}`, "at a glance")}
      <section className="scar-stats" aria-label="site health">
        <div className="scar-stat" data-accent="neon">
          <div className="scar-stat__n">● live</div>
          <div className="scar-stat__l">Site status</div>
          <div className="scar-stat__sub">the console is serving</div>
        </div>
        <div className="scar-stat" data-accent="cyan">
          <div className="scar-stat__n" style={{ fontSize: 15 }}>
            <span className="scar-starbox" aria-hidden="true" />{" "}
            {tip ? `${tip.estimated ? "~" : ""}${tip.height.toLocaleString()}` : "…"}
          </div>
          <div className="scar-stat__l">Chain tip</div>
          <div className="scar-stat__sub">
            {tip?.estimated ? "~ genesis estimate — wire a node" : "the fleet's own door · read-only"}
          </div>
        </div>
        <div className="scar-stat" data-accent="cyan">
          <div className="scar-stat__n">{wired ? `${wired.up} / ${NODE_DOORS.length}` : "…"}</div>
          <div className="scar-stat__l">Nodes wired</div>
          <div className="scar-stat__sub">
            {!wired
              ? "checking the doors…"
              : wired.dark.length === 0
                ? "all doors reachable"
                : `${wired.dark.join(" · ").toLowerCase()} still dark`}
          </div>
        </div>
        <div className="scar-stat" data-accent="pink">
          <div className="scar-stat__n">{n(needsYou)}</div>
          <div className="scar-stat__l">Needs you</div>
          <div className="scar-stat__sub">sign · rule · review</div>
        </div>
      </section>

      {grp("pink", "NEEDS YOUR KEY", "each card is a door — the counts are the boards' own")}
      <section className="scar-stats" aria-label="what needs you — doors into the rooms">
        <Link href="/a/action#signoffs" className="scar-stat" data-accent="pink">
          <div className="scar-stat__n">{n(counts?.signoffs)}</div>
          <div className="scar-stat__l">Sign-offs</div>
          <div className="scar-stat__sub">cross-project · awaiting your key</div>
        </Link>
        <Link href="/a/action#decisions" className="scar-stat" data-accent="cyan">
          <div className="scar-stat__n">{n(counts?.decisions)}</div>
          <div className="scar-stat__l">Decisions</div>
          <div className="scar-stat__sub">rulings open</div>
        </Link>
        <Link href="/a/briefs" className="scar-stat" data-accent="cyan">
          <div className="scar-stat__n">{n(counts?.review)}</div>
          <div className="scar-stat__l">Briefs to review</div>
          <div className="scar-stat__sub">read then rule</div>
        </Link>
        <Link href="/a/testing#roster" className="scar-stat" data-accent="neon">
          <div className="scar-stat__n">{n(counts?.tickets)}</div>
          <div className="scar-stat__l">Tickets open</div>
          <div className="scar-stat__sub">the duty roster</div>
        </Link>
      </section>
      <p className="mt-3 font-mono text-[11px] text-white/40">
        Every count reads live from its own board — a <b className="text-white/60">people-and-work
        count, never a money figure</b>; coin stays money-only.
      </p>

      {grp("pink", "FIRST CAPTAINS · ONBOARDING", "start here")}
      <div className="space-y-3">
        {[
          {
            step: "STEP 01",
            pill: "claim",
            accent: "pink",
            title: "Claim your @space",
            detail:
              "Register your name on the Spaces protocol — the site's front door walks you from watching the auction block to the claim.",
            href: CONSOLE_SITE.home,
            cta: `Open ${CONSOLE_SITE.domain}`,
          },
          {
            step: "STEP 02",
            pill: "read",
            accent: "cyan",
            title: "Read the briefs — how the world works",
            detail:
              "What a top-level costs the block, self-custody, the BFT clock. Learn before you etch — we are the defenders of the block.",
            href: "/a/briefs",
            cta: "Open the briefs",
          },
          {
            step: "STEP 03",
            pill: "optional",
            accent: "cyan",
            title: "Wire your Connections",
            detail:
              "Point the console at your own nodes — Spaces, Chat, Chain, Briefs. Leave one empty and it falls back honestly.",
            href: "/a/connections",
            cta: "Go to Connections",
          },
          {
            step: "STEP 04",
            pill: "sign",
            accent: "neon",
            title: "Sign your first act",
            detail:
              "Everything you approve is a signed, block-stamped event. Head to Status to see what needs your key first.",
            href: "/a/status",
            cta: "Open Status",
          },
        ].map((s) => (
          <div key={s.step} className="console-card p-5 text-center" data-accent={s.accent}>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/30">
                {s.step}
              </span>
              <span className="pill" data-accent={s.accent}>
                {s.pill}
              </span>
            </div>
            <p className="mt-1.5 font-pixel text-sm uppercase leading-snug text-white/90">
              {s.title}
            </p>
            <p className="mx-auto mt-1 max-w-xl font-body text-sm text-white/55">{s.detail}</p>
            <div className="mt-3 flex justify-center">
              {/* ONE uniform onboarding button size */}
              <Link href={s.href} data-accent={s.accent} className="btn-pill min-w-[220px]">
                {s.cta}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
