"use client";

import { useCallback, useEffect, useState } from "react";
import { bftDateTime } from "@/lib/bb/bft";
import { ScarConsole, type ReaderContent } from "@/components/console/ReaderDrawer";

/**
 * SIGN-OFFS — the cross-project approval tickets on the Action Items board.
 * Work raised across the fleet (pacsarcade, knowledge-engine, the shared-
 * secrets rotation) lands here so the admiral signs everything from one desk.
 * The board is a list of ticket cards; selecting one opens the READER DRAWER
 * (closed by default, ⤢ expand-full, ✕/Escape closes) with the project tag,
 * "what you're signing off" in plain words, the change list, Number One's
 * read, a comment box, and the ticket's OWN gesture button. The gesture signs
 * `PACS-SIGNOFF-<id>-<ts>-sign` (+ the comment) with the operator key — the
 * console's signed-action model — and POSTs it to the gated API.
 *
 * Colour law, STRICT: gold/coin = MONEY only. No sign-off wears gold —
 * ghost = danger (SEC-0001), cyan = info/systems, pink = flair.
 * Types are inlined: the signoffs store pulls server-only modules.
 */

type Tone = "neon" | "cyan" | "pink" | "ghost";
interface SignoffChange {
  kind: "add" | "del" | "note";
  text: string;
}
interface Signoff {
  id: string;
  project: string;
  area: string;
  title: string;
  sum: string;
  raisedBy: string;
  tone: Tone;
  danger?: boolean;
  detail: string[];
  changes: SignoffChange[];
  rec: string;
  gesture: string;
  status: "open" | "signed";
  comment?: string;
  at?: number;
}

const CHANGE_GLYPH: Record<SignoffChange["kind"], { glyph: string; cls: string }> = {
  add: { glyph: "+", cls: "text-neon" },
  del: { glyph: "−", cls: "text-ghost" },
  note: { glyph: "·", cls: "text-white/40" },
};

export default function SignoffsPanel() {
  const [signoffs, setSignoffs] = useState<Signoff[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/admin/signoffs");
      if (res.status === 401) {
        setSignoffs([]);
        setErr("operator sign-in required");
        return;
      }
      const data = await res.json();
      if (data.ok) setSignoffs(data.signoffs);
      else setErr(data.reason ?? "couldn't read the board");
    } catch {
      setErr("couldn't reach the app — try again");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** the gesture — sign the ticket's action string with the operator key */
  async function sign(t: Signoff) {
    const comment = (drafts[t.id] ?? "").trim();
    if (!window.nostr?.signEvent) {
      setErr("no signer extension found — install nos2x or Alby, then try again");
      return;
    }
    setErr(null);
    setOk(null);
    setBusy(t.id);
    let event;
    try {
      event = await window.nostr.signEvent({
        kind: 22242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: `PACS-SIGNOFF-${t.id}-${Date.now()}-sign${comment ? `\n${comment}` : ""}`,
      });
    } catch {
      setErr("signing was declined — nothing sent");
      setBusy(null);
      return;
    }
    try {
      const res = await fetch("/api/admin/signoffs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signoff: event }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setErr(data?.reason ?? `the server hiccuped (HTTP ${res.status}) — your signature was fine`);
        return;
      }
      setOk(`signed — ${t.id} · ${t.gesture}`);
      setDrafts((p) => {
        const n = { ...p };
        delete n[t.id];
        return n;
      });
      load();
    } catch {
      setErr("couldn't reach the server — check your connection and try again");
    } finally {
      setBusy(null);
    }
  }

  const all = signoffs ?? [];
  const open = all.filter((s) => s.status === "open");
  const signed = all.filter((s) => s.status === "signed");
  const current = selected ? all.find((s) => s.id === selected) ?? null : null;

  function chips(t: Signoff) {
    return (
      <>
        <span className="pill" data-accent={t.tone}>
          {t.project}
        </span>
        {t.danger && (
          <span className="pill pill--solid" data-accent="ghost">
            ⚠ DANGER · HIGH
          </span>
        )}
        {t.status === "signed" && (
          <span className="pill" data-accent="neon">
            ✓ SIGNED
          </span>
        )}
      </>
    );
  }

  const reader: ReaderContent | null = current
    ? {
        accent: current.tone,
        code: `${current.id} · ${current.area}`,
        title: current.title,
        chips: chips(current),
        meta: (
          <>
            <span>
              raised by <b className="font-bold text-white/60">{current.raisedBy}</b>
            </span>
            {current.at && (
              <span className="text-neon/80">✓ signed · {bftDateTime(current.at)}</span>
            )}
          </>
        ),
        body: (
          <div>
            {current.detail.map((p, i) => (
              <p key={i} className="mt-2 font-body text-sm leading-relaxed text-white/65 first:mt-0">
                {p}
              </p>
            ))}

            <p className="mt-4 font-pixel text-[9px] uppercase text-white/40">THE CHANGE</p>
            <ul className="mt-1.5 space-y-1.5">
              {current.changes.map((c, i) => (
                <li key={i} className="flex gap-2 font-mono text-[11px] leading-relaxed text-white/60">
                  <span aria-hidden className={`w-3 shrink-0 text-center ${CHANGE_GLYPH[c.kind].cls}`}>
                    {CHANGE_GLYPH[c.kind].glyph}
                  </span>
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>

            <div
              className="mt-4 rounded-lg border-l-2 py-1 pl-3"
              style={{ borderColor: "var(--acc)" }}
            >
              <p className="font-pixel text-[9px] uppercase text-white/40">
                ✦ NUMBER ONE&apos;S READ
              </p>
              <p className="mt-1 font-body text-xs leading-relaxed text-white/70">{current.rec}</p>
            </div>

            {current.status === "open" ? (
              <div className="mt-5 border-t border-edge pt-4">
                <label className="block">
                  <span className="font-pixel text-[9px] uppercase text-white/40">
                    COMMENT — OPTIONAL, RIDES THE SIGNATURE
                  </span>
                  <textarea
                    value={drafts[current.id] ?? ""}
                    onChange={(e) =>
                      setDrafts((p) => ({ ...p, [current.id]: e.target.value }))
                    }
                    rows={2}
                    placeholder="what you want on the record (optional)"
                    className="mt-1 w-full rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-white/85 placeholder:text-white/25 focus:border-cyan focus:outline-none"
                  />
                </label>
                <button
                  onClick={() => sign(current)}
                  disabled={busy === current.id}
                  data-accent={current.tone}
                  className="btn-pill btn-pill--solid mt-3"
                >
                  {busy === current.id ? "SIGNING…" : `✍ ${current.gesture.toUpperCase()}`}
                </button>
                <p className="mt-2 font-mono text-[11px] text-white/40">
                  your key signs the act — PACS-SIGNOFF-{current.id}-…
                </p>
              </div>
            ) : (
              <div className="mt-5 border-t border-edge pt-4">
                <p className="font-pixel text-[10px] uppercase text-neon">
                  ✓ SIGNED{current.at ? ` · ${bftDateTime(current.at)}` : ""}
                </p>
                {current.comment && (
                  <p className="mt-2 font-mono text-[11px] leading-relaxed text-white/50">
                    &ldquo;{current.comment}&rdquo;
                  </p>
                )}
              </div>
            )}
          </div>
        ),
      }
    : null;

  function card(t: Signoff) {
    return (
      <button
        key={t.id}
        onClick={() => {
          setSelected(t.id);
          setErr(null);
          setOk(null);
        }}
        data-accent={t.tone}
        className={`console-card console-card--hover flex w-full items-stretch gap-3 overflow-hidden text-left ${
          selected === t.id ? "console-card--active" : ""
        }`}
      >
        <span aria-hidden className="w-1.5 shrink-0" style={{ background: "var(--acc)" }} />
        <span className="min-w-0 flex-1 p-4">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase text-white/30">{t.id}</span>
            {chips(t)}
            {t.status === "signed" && t.at && (
              <span className="font-mono text-[10px] text-white/30">✓ {bftDateTime(t.at)}</span>
            )}
          </span>
          <span className="mt-1.5 block font-pixel text-sm uppercase leading-snug text-white/90">
            {t.title}
          </span>
          <span className="mt-1 block font-body text-sm text-white/55">{t.sum}</span>
        </span>
      </button>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <p className="lcars-eyebrow mb-3" data-accent="pink">
        SIGN-OFFS · CROSS-PROJECT · NEEDS YOUR KEY
      </p>
      <p className="mb-6 font-body text-sm text-white/55">
        Approvals raised across the fleet, signed from this one desk. Select a ticket to read what
        you&apos;re signing off — the reader opens on the right with the comment box and the
        ticket&apos;s own gesture.
      </p>

      {err && <p className="mb-4 font-pixel text-[10px] uppercase text-ghost">{err}</p>}
      {ok && <p className="mb-4 font-pixel text-[10px] uppercase text-neon">{ok}</p>}

      <ScarConsole reader={reader} onClose={() => setSelected(null)}>
        {!signoffs ? (
          <p className="font-body text-sm text-white/50">Reading the board…</p>
        ) : (
          <div className="space-y-8">
            {open.length === 0 ? (
              <p className="console-card p-4 font-body text-sm text-white/60">
                Nothing awaiting your key — the cross-project lane is clear. 🌱
              </p>
            ) : (
              <section>
                <p
                  className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-pink/80"
                  data-accent="pink"
                >
                  AWAITING YOUR KEY · {open.length}
                </p>
                <div className="space-y-3">{open.map(card)}</div>
              </section>
            )}
            {signed.length > 0 && (
              <section>
                <p className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-white/40">
                  ✓ SIGNED · {signed.length} — RECORDED, BLOCK-STAMPED
                </p>
                <div className="space-y-3">{signed.map(card)}</div>
              </section>
            )}
          </div>
        )}
      </ScarConsole>
    </div>
  );
}
