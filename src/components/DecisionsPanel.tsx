"use client";

import { useCallback, useEffect, useState } from "react";
import { bftDateTime } from "@/lib/bb/bft";

/**
 * The Decisions room — pending rulings as ACTION cards. Each open decision
 * shows the question, the context, the options as selectable chips (Number
 * One's pick badged ✦ RECOMMENDED in neon with its why), a note box, and a
 * one-click RECORD MY CHOICE. Decided ones collapse into a BFT-stamped list.
 * Types are inlined on purpose: the decisions store pulls server-only modules,
 * so a client component must not import it.
 */

interface DecisionOption {
  key: string;
  label: string;
  note?: string;
  link?: string; // an asset to preview in a new tab before voting
}
interface Decision {
  id: string;
  question: string;
  context: string;
  options: DecisionOption[];
  recommendation: string;
  recommendationWhy: string;
  status: "open" | "revise" | "decided";
  choice?: string;
  note?: string;
  at?: number;
  atEstimated?: boolean;
  revise?: boolean;
  source?: string;
}

/** BFT stamp, honest: `~ ` when the network was dark at record time (the
    height is a genesis estimate, never a block fact). */
const stamp = (at: number, estimated?: boolean) => `${estimated ? "~ " : ""}${bftDateTime(at)}`;

export default function DecisionsPanel() {
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savingKind, setSavingKind] = useState<"record" | "revise" | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/admin/decisions");
      if (res.status === 401) {
        setDecisions([]);
        setErr("operator sign-in required");
        return;
      }
      const data = await res.json();
      if (data.ok) setDecisions(data.decisions);
      else setErr(data.reason ?? "couldn't read the board");
    } catch {
      setErr("couldn't reach the app — try again");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function record(id: string) {
    const choice = picks[id];
    if (!choice) {
      setErr("pick an option first");
      return;
    }
    setErr(null);
    setOk(null);
    setSaving(id);
    setSavingKind("record");
    try {
      const res = await fetch("/api/admin/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, choice, note: notes[id] ?? "" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setErr(data?.reason ?? `the server hiccuped (HTTP ${res.status}) — try again`);
        return;
      }
      setOk(`recorded — ${data.decision.id}`);
      setPicks((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      setNotes((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      load();
    } catch {
      setErr("couldn't reach the server — check your connection and try again");
    } finally {
      setSaving(null);
      setSavingKind(null);
    }
  }

  /* Send back for another pass: a note with NO pick — "none of these, here's
     what to change." Goes back for review and comes back around as a fresh
     decision. The note is required; the option pick is not. */
  async function sendBack(id: string) {
    const note = (notes[id] ?? "").trim();
    if (!note) {
      setErr("write a note first — tell Number One what to change");
      return;
    }
    setErr(null);
    setOk(null);
    setSaving(id);
    setSavingKind("revise");
    try {
      const res = await fetch("/api/admin/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, revise: true, note }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setErr(data?.reason ?? `the server hiccuped (HTTP ${res.status}) — try again`);
        return;
      }
      setOk(`sent back — ${data.decision.id}`);
      setPicks((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      setNotes((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      load();
    } catch {
      setErr("couldn't reach the server — check your connection and try again");
    } finally {
      setSaving(null);
      setSavingKind(null);
    }
  }

  const open = (decisions ?? []).filter((d) => d.status === "open");
  const revise = (decisions ?? []).filter((d) => d.status === "revise");
  const decided = (decisions ?? []).filter((d) => d.status === "decided");

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="lcars-eyebrow mb-3" data-accent="pink">
        DECISIONS · NUMBER ONE RECOMMENDS, YOU RECORD
      </p>
      <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">DECISION BOARD</h1>
      <p className="mb-8 font-body text-sm text-white/55">
        The pending rulings — each one a card, each one one click from done.
      </p>

      {err && <p className="mb-4 font-pixel text-[10px] uppercase text-ghost">{err}</p>}
      {ok && <p className="mb-4 font-pixel text-[10px] uppercase text-neon">{ok}</p>}

      <h2 className="mb-3 font-pixel text-xs uppercase text-white/50">
        ON THE BOARD
        {decisions ? <span className="text-white/30"> · {open.length}</span> : null}
      </h2>

      {!decisions ? (
        <p className="font-body text-sm text-white/50">Reading the board…</p>
      ) : open.length === 0 ? (
        <p className="console-card p-4 font-body text-sm text-white/60">
          The board is clear — no decisions waiting. 🌱
        </p>
      ) : (
        <div className="space-y-4">
          {open.map((d) => {
            const picked = picks[d.id];
            const hasNote = (notes[d.id] ?? "").trim().length > 0;
            return (
              <div key={d.id} className="console-card p-5" data-accent="pink">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase text-white/30">{d.id}</span>
                  {d.source && (
                    <span className="font-mono text-[10px] uppercase text-white/30">{d.source}</span>
                  )}
                </div>
                <h3 className="mt-1 font-pixel text-base uppercase leading-snug text-cyan">
                  {d.question}
                </h3>
                <p className="mt-2 font-body text-sm text-white/60">{d.context}</p>

                <div className="mt-4 space-y-2">
                  {d.options.map((o) => {
                    const isRec = o.key === d.recommendation;
                    const isPicked = picked === o.key;
                    return (
                      <div key={o.key} className="relative">
                        <button
                          onClick={() => setPicks((p) => ({ ...p, [d.id]: o.key }))}
                          aria-pressed={isPicked}
                          className={`block w-full rounded-lg border-2 p-3 text-left transition-colors ${
                            isPicked
                              ? "border-cyan bg-cyan/5"
                              : "border-edge hover:border-cyan/50"
                          } ${o.link ? "pr-24" : ""}`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              aria-hidden
                              className={`font-mono text-sm ${isPicked ? "text-cyan" : "text-white/40"}`}
                            >
                              {isPicked ? "◉" : "○"}
                            </span>
                            <span className={`font-body text-sm ${isPicked ? "text-cyan" : "text-white/85"}`}>
                              {o.label}
                            </span>
                            {isRec && (
                              <span className="pill" data-accent="neon">
                                ✦ RECOMMENDED
                              </span>
                            )}
                          </div>
                          {o.note && (
                            <p className="mt-1 pl-6 font-mono text-[11px] text-white/45">{o.note}</p>
                          )}
                          {isRec && (
                            <p className="mt-2 pl-6 font-body text-xs leading-relaxed text-neon/80">
                              {d.recommendationWhy}
                            </p>
                          )}
                        </button>
                        {/* preview the asset before voting — a sibling of the
                            button (never nested in it), so the click opens the
                            asset instead of selecting the option. */}
                        {o.link && (
                          <a
                            href={o.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-3 top-3 inline-flex min-h-11 items-center font-mono text-[11px] text-cyan underline decoration-cyan/40 underline-offset-2 hover:decoration-cyan focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan"
                          >
                            ▸ SEE IT
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>

                <label className="mt-4 block">
                  <span className="font-pixel text-[9px] uppercase text-white/40">
                    NOTE — OPTIONAL, RIDES THE RECORD
                  </span>
                  <textarea
                    value={notes[d.id] ?? ""}
                    onChange={(e) => setNotes((p) => ({ ...p, [d.id]: e.target.value }))}
                    rows={2}
                    placeholder="why you called it this way (optional)"
                    className="mt-1 w-full rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-white/85 placeholder:text-white/25 focus:border-cyan focus:outline-none"
                  />
                </label>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => record(d.id)}
                    disabled={!picked || saving === d.id}
                    data-accent="neon"
                    className="btn-pill btn-pill--solid"
                  >
                    {saving === d.id && savingKind === "record"
                      ? "RECORDING…"
                      : "✍ RECORD MY CHOICE"}
                  </button>
                  {/* send back for another pass — a note with NO pick. Reads as
                      secondary to RECORD: cyan outline, not the neon solid.
                      Enabled the moment the note has text; no option required. */}
                  <button
                    onClick={() => sendBack(d.id)}
                    disabled={!hasNote || saving === d.id}
                    data-accent="cyan"
                    className="btn-pill"
                  >
                    {saving === d.id && savingKind === "revise"
                      ? "SENDING BACK…"
                      : "↩ SEND BACK FOR ANOTHER PASS"}
                  </button>
                </div>
                {!hasNote && (
                  <p className="mt-2 font-mono text-[11px] text-white/40">
                    write a note first — tell Number One what to change
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {revise.length > 0 && (
        <div className="mt-10">
          <p
            className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-cyan/80"
            data-accent="cyan"
          >
            ↩ SENT BACK · NUMBER ONE IS REWORKING THESE · {revise.length}
          </p>
          <div className="space-y-2">
            {revise.map((d) => (
              <div key={d.id} className="console-card p-4" data-accent="cyan">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase text-white/30">{d.id}</span>
                  <span className="font-mono text-[10px] text-cyan">
                    ↩ {d.at ? stamp(d.at, d.atEstimated) : "sent back"}
                  </span>
                </div>
                <p className="mt-1 font-body text-sm text-white/80">{d.question}</p>
                {d.note && (
                  <p className="mt-2 font-mono text-[11px] leading-relaxed text-cyan/85">
                    ▸ {d.note}
                  </p>
                )}
                <p className="mt-2 font-pixel text-[9px] uppercase text-white/35">
                  awaiting rework — comes back for another decision
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {decided.length > 0 && (
        <div className="mt-10">
          <p className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-white/40">
            DECIDED · {decided.length} — RECORDED, BLOCK-STAMPED
          </p>
          <div className="space-y-2">
            {decided.map((d) => {
              const chosen = d.options.find((o) => o.key === d.choice);
              return (
                <div key={d.id} className="console-card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase text-white/30">{d.id}</span>
                    <span className="font-mono text-[10px] text-neon">
                      ✓ {d.at ? stamp(d.at, d.atEstimated) : "recorded"}
                    </span>
                  </div>
                  <p className="mt-1 font-body text-sm text-white/80">{d.question}</p>
                  <p className="mt-1 font-pixel text-[10px] uppercase text-neon">
                    ✓ {chosen?.label ?? d.choice}
                  </p>
                  {d.note && (
                    <p className="mt-1 font-mono text-[11px] text-white/50">
                      &ldquo;{d.note}&rdquo;
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
