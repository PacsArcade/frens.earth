"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The Duty Roster, two doors from one panel:
 *   mode="support" — a fren RAISES tickets and watches their own.
 *   mode="crew"    — the admiral + crew WORK every ticket (claim / resolve).
 * Types are inlined on purpose: the ticket store pulls server-only modules, so
 * a client component must not import it.
 */

type TicketKind = "request" | "incident" | "problem" | "change" | "spark";
type TicketStatus = "open" | "claimed" | "resolved";
interface Ticket {
  id: string;
  kind: TicketKind;
  title: string;
  detail: string;
  status: TicketStatus;
  raisedBy: string;
  claimedBy: string | null;
  createdAt: string;
  notes: { by: string; note: string; at: string }[];
}

const KINDS: { v: TicketKind; label: string }[] = [
  { v: "request", label: "REQUEST" },
  { v: "incident", label: "INCIDENT" },
  { v: "problem", label: "PROBLEM" },
  { v: "change", label: "CHANGE" },
  { v: "spark", label: "SPARK" },
];

function StatusPill({ s }: { s: TicketStatus }) {
  const map = {
    open: "border-coin text-coin",
    claimed: "border-cyan text-cyan glow-cyan",
    resolved: "border-neon text-neon glow-neon",
  } as const;
  return (
    <span className={`inline-block border-2 px-2 py-0.5 font-pixel text-[9px] uppercase ${map[s]}`}>
      {s}
    </span>
  );
}

export default function TicketsPanel({ mode }: { mode: "support" | "crew" }) {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/tickets");
      if (res.status === 401) {
        setAuthed(false);
        setTickets([]);
        return;
      }
      const data = await res.json();
      if (data.ok) {
        setTickets(data.tickets);
        setAuthed(true);
      }
    } catch {
      setErr("couldn't load the roster — try again");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const [kind, setKind] = useState<TicketKind>("request");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [raising, setRaising] = useState(false);

  async function raise() {
    setErr(null);
    setRaising(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title, detail }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErr(data.reason ?? "couldn't raise it");
        return;
      }
      setTitle("");
      setDetail("");
      setKind("request");
      load();
    } catch {
      setErr("couldn't raise the ticket — try again");
    } finally {
      setRaising(false);
    }
  }

  async function act(id: string, action: string) {
    await fetch(`/api/tickets/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    load();
  }

  const isCrew = mode === "crew";

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
        {isCrew ? "OPERATOR CONSOLE ▸ FRENS.EARTH" : "FRENS.EARTH ▸ SUPPORT"}
      </p>
      <h1 className="mb-3 font-arcade text-4xl text-cyan glow-cyan">
        {isCrew ? "DUTY ROSTER" : "RAISE A TICKET"}
      </h1>
      <p className="mb-8 font-mono text-[11px] text-white/50">
        {isCrew
          ? "EVERY TICKET FROM THE FRENS — CLAIM IT, WORK IT, RESOLVE IT"
          : "SOMETHING BROKEN, MISSING, OR A SPARK OF AN IDEA? TELL THE CREW"}
      </p>

      {err && <p className="mb-4 font-pixel text-[10px] uppercase text-ghost">{err}</p>}

      {!isCrew && authed === false && (
        <div className="border-2 border-coin/60 bg-coin/5 p-4 font-body text-sm text-white/80">
          <p className="mb-2 font-pixel text-[10px] uppercase text-coin">SIGN IN FIRST</p>
          <p>
            Tickets ride your <span className="text-pink">@frens</span> tag. Sign in with your key
            (or <a href="/" className="text-cyan hover:glow-cyan underline">claim a free tag</a>)
            and this is where you&apos;ll raise and track them.
          </p>
        </div>
      )}

      {!isCrew && authed && (
        <div className="mb-10 space-y-4 border-2 border-edge bg-panel p-5">
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button
                key={k.v}
                onClick={() => setKind(k.v)}
                className={`border-2 px-3 py-1.5 font-pixel text-[9px] uppercase ${
                  kind === k.v ? "border-cyan text-cyan" : "border-edge text-white/40 hover:text-white/70"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="font-pixel text-[9px] uppercase text-white/40">TITLE</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="one line — what's up?"
              className="mt-1 w-full border-2 border-edge bg-void px-3 py-2 font-body text-sm text-cyan placeholder:text-white/25 focus:border-cyan focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="font-pixel text-[9px] uppercase text-white/40">DETAILS</span>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={4}
              placeholder="what happened, what you expected, anything that helps"
              className="mt-1 w-full border-2 border-edge bg-void px-3 py-2 font-body text-sm text-white/80 placeholder:text-white/25 focus:border-cyan focus:outline-none"
            />
          </label>
          <button
            onClick={raise}
            disabled={raising || title.trim().length < 3}
            className="button block w-full text-center disabled:opacity-50"
          >
            {raising ? "SENDING…" : "▶ RAISE IT"}
          </button>
        </div>
      )}

      <h2 className="mb-3 font-pixel text-xs uppercase text-white/50">
        {isCrew ? "THE BOARD" : "MY TICKETS"}
        {tickets ? <span className="text-white/30"> · {tickets.length}</span> : null}
      </h2>

      {!tickets || tickets.length === 0 ? (
        <p className="font-body text-sm text-white/50">
          {busy ? "Reading the board…" : isCrew ? "No tickets on the board." : "Nothing raised yet."}
        </p>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <div key={t.id} className="border-2 border-edge bg-panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-white/40">{t.id}</span>
                  <StatusPill s={t.status} />
                </div>
                {isCrew && <span className="font-mono text-[11px] text-pink">{t.raisedBy}</span>}
              </div>
              <p className="mt-2 font-body text-sm text-white/90">{t.title}</p>
              {t.detail && <p className="mt-1 font-body text-xs text-white/50">{t.detail}</p>}
              {isCrew && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.status !== "claimed" && t.status !== "resolved" && (
                    <button
                      onClick={() => act(t.id, "claim")}
                      className="border-2 border-cyan px-3 py-1 font-pixel text-[9px] uppercase text-cyan hover:glow-cyan"
                    >
                      CLAIM
                    </button>
                  )}
                  {t.status !== "resolved" && (
                    <button
                      onClick={() => act(t.id, "resolve")}
                      className="border-2 border-neon px-3 py-1 font-pixel text-[9px] uppercase text-neon hover:glow-neon"
                    >
                      RESOLVE
                    </button>
                  )}
                  {t.status === "resolved" && (
                    <button
                      onClick={() => act(t.id, "reopen")}
                      className="border-2 border-edge px-3 py-1 font-pixel text-[9px] uppercase text-white/50 hover:text-white/80"
                    >
                      REOPEN
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
