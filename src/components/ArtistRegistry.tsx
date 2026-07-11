"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { bftDate, bftDateTime, estimateHeight } from "@/lib/bb/bft";

/**
 * The Artist Registry — the brand-kit door for artists:
 *   REQUEST — ask for your name on the Spaces protocol (a queue entry; the
 *             crew runs the on-chain auction from the node wallet).
 *   BOARD   — open/rolling auctions straight from this deployment's spaced
 *             node, honest tri-state when there's no node to read.
 *   WATCH   — names you're keeping an eye on, persisted per-npub.
 *
 * Gate order on load: signed out → sign-in nudge; signed in but not on the
 * artist roster → the honest LEVEL LOCKED screen; artist → the three tabs.
 * Types are inlined on purpose (the artist store pulls server-only modules).
 */

type Entitlement =
  | { state: "loading" }
  | { state: "signedout" }
  | { state: "locked"; handle: string; space: string }
  | { state: "artist"; handle: string; space: string };

type RequestStatus = "requested" | "auction" | "won" | "lost" | "anchored";
interface NameRequest {
  id: string;
  name: string;
  note: string;
  status: RequestStatus;
  createdAt: string;
  blockHeight: number | null;
  txid: string | null;
}

interface Watch {
  name: string;
  addedAt: string;
  blockHeight: number | null;
}

interface AuctionEntry {
  name: string;
  bid: number | null;
}
type Board =
  | { configured: false }
  | { configured: true; reachable: false; reason: string }
  | {
      configured: true;
      reachable: true;
      chain: string | null;
      tip: { height?: number; hash?: string } | null;
      auctions: AuctionEntry[];
    };

type NameCheck =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "nonode" }
  | { kind: "unreachable"; reason: string }
  | { kind: "known"; status: "available" | "rollout" | "auction" | "registered" | "unknown"; detail: string };

type Tab = "request" | "board" | "watch";

/** BFT stamp, house standard: the real block when recorded (▣), a ~estimate
    from the timestamp when not. */
function bftStamp(at: string, blockHeight: number | null): string {
  if (blockHeight != null) return `▣ ${blockHeight.toLocaleString()} · ${bftDateTime(blockHeight)}`;
  return `~ ${bftDateTime(estimateHeight(new Date(at).getTime()))}`;
}

function StatusPill({ s }: { s: RequestStatus }) {
  const map: Record<RequestStatus, { cls: string; label: string }> = {
    requested: { cls: "border-cyan text-cyan", label: "REQUESTED" },
    auction: { cls: "border-pink text-pink glow-pink", label: "IN AUCTION" },
    won: { cls: "border-neon text-neon glow-neon", label: "WON" },
    lost: { cls: "border-ghost text-ghost", label: "LOST" },
    anchored: { cls: "border-neon text-neon glow-neon", label: "▣ ANCHORED" },
  };
  const m = map[s];
  return (
    <span className={`inline-block border-2 px-2 py-0.5 font-pixel text-[9px] uppercase ${m.cls}`}>
      {m.label}
    </span>
  );
}

function Pill({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-block border-2 px-2 py-0.5 font-pixel text-[9px] uppercase ${
        ok ? "border-neon text-neon glow-neon" : "border-ghost text-ghost"
      }`}
    >
      {children}
    </span>
  );
}

/** The tone of a live name-check line — never gold (names aren't money). */
function checkLine(check: NameCheck): { text: string; cls: string } | null {
  switch (check.kind) {
    case "idle":
      return { text: "TYPE A NAME TO CHECK THE CHAIN", cls: "text-cyan glow-cyan" };
    case "checking":
      return { text: "CHECKING THE CHAIN…", cls: "text-cyan pulse-neon" };
    case "nonode":
      return {
        text: "NO NODE CONNECTED — CAN'T CHECK THE CHAIN (A REQUEST STILL FILES)",
        cls: "text-white/50",
      };
    case "unreachable":
      return { text: `NODE UNREACHABLE — CAN'T CHECK THE CHAIN`, cls: "text-white/50" };
    case "known":
      switch (check.status) {
        case "available":
          return { text: "NO ON-CHAIN RECORD — OPEN TO A BID", cls: "text-neon glow-neon" };
        case "rollout":
          return { text: `IN PLAY — ${check.detail.toUpperCase()}`, cls: "text-pink glow-pink" };
        case "auction":
          return { text: `IN PLAY — ${check.detail.toUpperCase()}`, cls: "text-pink glow-pink" };
        case "registered":
          return { text: "TAKEN — SOMEONE HOLDS THIS NAME", cls: "text-ghost glow-ghost" };
        case "unknown":
          return { text: check.detail.toUpperCase(), cls: "text-cyan" };
      }
  }
}

export default function ArtistRegistry() {
  const [gate, setGate] = useState<Entitlement>({ state: "loading" });
  const [tab, setTab] = useState<Tab>("request");
  const [err, setErr] = useState<string | null>(null);

  const [requests, setRequests] = useState<NameRequest[] | null>(null);
  const [watches, setWatches] = useState<Watch[] | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [boardBusy, setBoardBusy] = useState(false);

  useEffect(() => {
    fetch("/api/artist/entitlement")
      .then(async (res) => {
        if (res.status === 401) {
          setGate({ state: "signedout" });
          return;
        }
        const data = await res.json();
        if (!data.ok) throw new Error();
        setGate({ state: data.artist ? "artist" : "locked", handle: data.handle, space: data.space });
      })
      .catch(() => setErr("couldn't reach the arcade — refresh to try again"));
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/artist/requests");
      const data = await res.json();
      if (data.ok) setRequests(data.requests);
    } catch {
      /* keep whatever we had */
    }
  }, []);

  const loadWatches = useCallback(async () => {
    try {
      const res = await fetch("/api/artist/watches");
      const data = await res.json();
      if (data.ok) setWatches(data.watches);
    } catch {
      /* keep whatever we had */
    }
  }, []);

  const loadBoard = useCallback(async () => {
    setBoardBusy(true);
    try {
      const res = await fetch("/api/artist/auctions");
      const data = await res.json();
      if (data.ok) setBoard(data);
    } catch {
      /* keep whatever we had */
    } finally {
      setBoardBusy(false);
    }
  }, []);

  useEffect(() => {
    if (gate.state !== "artist") return;
    loadRequests();
    loadWatches();
    loadBoard();
  }, [gate.state, loadRequests, loadWatches, loadBoard]);

  const addToWatchlist = useCallback(
    async (name: string) => {
      try {
        const res = await fetch("/api/artist/watches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const data = await res.json();
        if (!data.ok) {
          setErr(data.reason ?? "couldn't watch that name");
          return;
        }
        loadWatches();
      } catch {
        setErr("couldn't watch that name — try again");
      }
    },
    [loadWatches]
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: "request", label: requests?.length ? `REQUEST · ${requests.length}` : "REQUEST" },
    {
      id: "board",
      label:
        board && board.configured && board.reachable !== false && "auctions" in board
          ? `AUCTION BOARD · ${board.auctions.length}`
          : "AUCTION BOARD",
    },
    { id: "watch", label: watches?.length ? `WATCHLIST · ${watches.length}` : "WATCHLIST" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
        PAC&apos;S ARCADE BRAND KIT ▸ ARTIST TRAINING
      </p>
      <h1 className="mb-3 font-arcade text-4xl text-pink glow-pink">ARTIST REGISTRY</h1>
      <p className="mb-8 font-mono text-[11px] text-white/50">
        YOUR NAME ON THE SPACES PROTOCOL — REQUEST IT · WATCH THE AUCTION · ANCHOR IT TO BITCOIN
      </p>

      {err && <p className="mb-4 font-pixel text-[10px] uppercase text-ghost">{err}</p>}

      {gate.state === "loading" && (
        <p className="font-body text-sm text-white/50">Checking your entitlement…</p>
      )}

      {gate.state === "signedout" && (
        <div className="border-2 border-coin/60 bg-coin/5 p-4 font-body text-sm text-white/80">
          <p className="mb-2 font-pixel text-[10px] uppercase text-coin">SIGN IN FIRST</p>
          <p>
            The Artist Registry rides your tag. Sign in with your key (or{" "}
            <Link href="/" className="text-cyan hover:glow-cyan underline">
              claim a free tag
            </Link>
            ) and come back through this door.
          </p>
        </div>
      )}

      {gate.state === "locked" && (
        <div className="border-2 border-edge bg-panel p-6">
          <p className="mb-4 font-pixel text-xs text-white/30">
            🔒 LEVEL LOCKED — THE ARTIST TRAINING PACKAGE OPENS THIS DOOR
          </p>
          <div className="space-y-3 font-body text-sm text-white/70">
            <p>
              You&apos;re signed in as{" "}
              <span className="text-cyan">
                {gate.handle}@{gate.space}
              </span>
              , but this tag&apos;s key isn&apos;t on the artist roster yet. No tricks, no hidden
              switch — the door is simply locked.
            </p>
            <p>
              The registry ships with the <span className="text-pink">Pac&apos;s Arcade branding
              kit</span>&apos;s artist training package: finish the training and the crew adds your
              key to the roster. Already through it?{" "}
              <Link href="/support" className="text-cyan hover:glow-cyan underline">
                Raise a ticket with the crew
              </Link>{" "}
              and they&apos;ll flip the switch.
            </p>
          </div>
        </div>
      )}

      {gate.state === "artist" && (
        <>
          <div className="mb-8 flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`min-h-11 border-2 px-4 py-2 font-pixel text-[10px] uppercase ${
                  tab === t.id
                    ? "border-pink text-pink glow-pink"
                    : "border-edge text-white/50 hover:text-white/80"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "request" && (
            <RequestTab
              handle={gate.handle}
              space={gate.space}
              requests={requests}
              onFiled={loadRequests}
            />
          )}
          {tab === "board" && (
            <BoardTab
              board={board}
              busy={boardBusy}
              watches={watches}
              onWatch={addToWatchlist}
              onReload={loadBoard}
            />
          )}
          {tab === "watch" && (
            <WatchTab watches={watches} onWatch={addToWatchlist} onChanged={loadWatches} />
          )}
        </>
      )}
    </div>
  );
}

/* ── REQUEST — ask for your name ─────────────────────────────────────────── */

function RequestTab({
  handle,
  space,
  requests,
  onFiled,
}: {
  handle: string;
  space: string;
  requests: NameRequest[] | null;
  onFiled: () => void;
}) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [check, setCheck] = useState<NameCheck>({ kind: "idle" });
  const [filing, setFiling] = useState(false);
  const [filed, setFiled] = useState<NameRequest | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!name.trim()) {
      setCheck({ kind: "idle" });
      return;
    }
    setCheck({ kind: "checking" });
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/artist/name?name=${encodeURIComponent(name.trim())}`);
        const data = await res.json();
        if (!data.ok) {
          setCheck({ kind: "idle" });
          return;
        }
        if (!data.configured) setCheck({ kind: "nonode" });
        else if (!data.reachable) setCheck({ kind: "unreachable", reason: data.reason ?? "" });
        else setCheck({ kind: "known", status: data.status, detail: data.detail ?? "" });
      } catch {
        setCheck({ kind: "idle" });
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name]);

  async function file() {
    setErr(null);
    setFiling(true);
    try {
      const res = await fetch("/api/artist/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, note }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErr(data.reason ?? "couldn't file it");
        return;
      }
      setFiled(data.request);
      setName("");
      setNote("");
      setCheck({ kind: "idle" });
      onFiled();
    } catch {
      setErr("couldn't file the request — try again");
    } finally {
      setFiling(false);
    }
  }

  const line = checkLine(check);
  const taken = check.kind === "known" && check.status === "registered";

  return (
    <div className="space-y-8">
      <div className="border-2 border-edge bg-panel p-6">
        <p className="mb-4 font-pixel text-xs text-cyan">REQUEST YOUR NAME</p>
        <div className="flex items-center border-4 border-edge bg-void px-3 py-3 focus-within:border-cyan sm:px-4">
          <span className="shrink-0 font-arcade text-xl text-pink glow-pink select-none sm:text-2xl">@</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            maxLength={63}
            spellCheck={false}
            autoComplete="off"
            placeholder="yourname"
            className="min-w-0 flex-1 bg-transparent font-arcade text-xl text-cyan outline-none placeholder:text-white/20 sm:text-2xl"
            aria-label="The space name you want"
          />
        </div>
        {line && (
          <p className={`mt-3 font-pixel text-xs ${line.cls}`} role="status">
            {line.text}
          </p>
        )}
        <label className="mt-4 block">
          <span className="font-pixel text-[9px] uppercase text-white/40">
            NOTE FOR THE CREW — OPTIONAL
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="why this name, where your art will fly it"
            className="mt-1 w-full border-2 border-edge bg-void px-3 py-2 font-body text-sm text-white/80 placeholder:text-white/25 focus:border-cyan focus:outline-none"
          />
        </label>
        <button
          onClick={file}
          disabled={filing || !name.trim() || taken}
          className="button mt-4 block w-full text-center disabled:cursor-not-allowed disabled:opacity-40"
        >
          {filing ? "FILING…" : taken ? "TAKEN — TRY ANOTHER" : "▶ FILE THE REQUEST"}
        </button>
        {err && <p className="mt-3 font-pixel text-[10px] uppercase text-ghost">{err}</p>}
        <p className="mt-3 font-body text-xs text-white/50">
          A request is a queue entry, not a bid. The crew opens the auction from the node&apos;s
          own wallet — keys never touch this app. Spaces are auctioned on Bitcoin: highest bid
          when the window closes takes the name.
        </p>
      </div>

      {filed && (
        <div className="border-2 border-neon/60 bg-neon/5 p-5">
          <p className="mb-2 font-pixel text-xs text-neon glow-neon">
            ✓ {filed.id} FILED — @{filed.name} IS ON THE CREW&apos;S BOARD
          </p>
          <p className="font-body text-sm text-white/70">
            From here the name walks the whole road on this page:{" "}
            <span className="text-cyan">REQUESTED</span> →{" "}
            <span className="text-pink">IN AUCTION</span> →{" "}
            <span className="text-neon">WON</span> /{" "}
            <span className="text-ghost">LOST</span> →{" "}
            <span className="text-neon">▣ ANCHORED</span>. Watch it below.
          </p>
        </div>
      )}

      <div>
        <h2 className="mb-3 font-pixel text-xs uppercase text-white/50">
          MY REQUESTS
          {requests ? <span className="text-white/30"> · {requests.length}</span> : null}
        </h2>
        {!requests || requests.length === 0 ? (
          <p className="font-body text-sm text-white/50">
            {requests ? "Nothing requested yet — your name goes up top." : "Reading the board…"}
          </p>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="border-2 border-edge bg-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-white/40">{r.id}</span>
                    <span className="font-arcade text-lg text-cyan">@{r.name}</span>
                    <StatusPill s={r.status} />
                  </div>
                  <span className="font-mono text-[11px] text-white/40">
                    {bftStamp(r.createdAt, r.blockHeight)}
                  </span>
                </div>
                {r.note && <p className="mt-2 font-body text-xs text-white/50">{r.note}</p>}
                {r.txid && (
                  <p className="mt-2 font-mono text-[11px] text-white/40">
                    TX <span className="text-cyan">{r.txid}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 font-body text-xs text-white/40">
          Requests ride your key, filed as {handle}@{space}. Status flips when the crew moves the
          auction on the node — refresh to see the latest.
        </p>
      </div>
    </div>
  );
}

/* ── BOARD — open/rolling auctions from the node ─────────────────────────── */

function BoardTab({
  board,
  busy,
  watches,
  onWatch,
  onReload,
}: {
  board: Board | null;
  busy: boolean;
  watches: Watch[] | null;
  onWatch: (name: string) => void;
  onReload: () => void;
}) {
  const watched = new Set((watches ?? []).map((w) => w.name));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="font-pixel text-xs text-cyan">THE AUCTION BOARD</p>
        <button
          onClick={onReload}
          disabled={busy}
          className="border-2 border-edge px-3 py-1 font-pixel text-[9px] uppercase text-white/60 hover:text-white/90 disabled:opacity-50"
        >
          {busy ? "…" : "RELOAD"}
        </button>
      </div>

      {!board ? (
        <p className="font-body text-sm text-white/50">
          {busy ? "Asking the node…" : "Couldn't read the board — reload to try again."}
        </p>
      ) : !board.configured ? (
        <div className="border-2 border-edge bg-panel p-5">
          <p className="mb-3">
            <Pill ok={false}>NO NODE CONNECTED</Pill>
          </p>
          <p className="font-body text-sm text-white/70">
            The board reads open auctions straight from this deployment&apos;s own{" "}
            <span className="font-mono text-cyan">spaced</span> node — no node, no board, and we
            won&apos;t pretend otherwise. The crew links one from the operator console; the moment
            it answers, live auctions land here.
          </p>
        </div>
      ) : board.reachable === false ? (
        <div className="border-2 border-edge bg-panel p-5">
          <p className="mb-3">
            <Pill ok={false}>NODE UNREACHABLE</Pill>
          </p>
          <p className="font-body text-sm text-white/70">
            A node is configured but it didn&apos;t answer:{" "}
            <span className="font-mono text-ghost">{board.reason}</span>. Nothing shown here is
            better than something made up — reload once it&apos;s back.
          </p>
        </div>
      ) : (
        <>
          <div className="border-2 border-edge bg-panel px-4 py-3 font-mono text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-white/40">
                CHAIN <span className="text-white/80">{board.chain ?? "—"}</span>
              </span>
              {board.tip?.height != null ? (
                <span className="text-coin glow-coin">
                  ▣ {board.tip.height.toLocaleString()} · {bftDate(board.tip.height)}
                </span>
              ) : (
                <span className="text-white/40">TIP —</span>
              )}
            </div>
          </div>

          {board.auctions.length === 0 ? (
            <p className="font-body text-sm text-white/50">
              The rollout window is empty right now — no names rolling toward auction. The chain
              moves every block; check back.
            </p>
          ) : (
            <div className="border-2 border-edge">
              {board.auctions.map((a) => (
                <div
                  key={a.name}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-edge px-4 py-2 font-mono text-xs last:border-b-0"
                >
                  <span className="font-arcade text-base text-cyan">@{a.name}</span>
                  <span className={a.bid != null ? "text-coin glow-coin" : "text-white/40"}>
                    {a.bid != null ? `${a.bid.toLocaleString()} sats` : "bid —"}
                  </span>
                  <button
                    onClick={() => onWatch(a.name)}
                    disabled={watched.has(a.name)}
                    className={`min-h-9 border-2 px-2 font-pixel text-[9px] uppercase ${
                      watched.has(a.name)
                        ? "border-neon/50 text-neon"
                        : "border-edge text-white/40 hover:border-cyan hover:text-cyan"
                    }`}
                  >
                    {watched.has(a.name) ? "★ WATCHING" : "☆ WATCH"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── WATCH — your name, your list ────────────────────────────────────────── */

function WatchTab({
  watches,
  onWatch,
  onChanged,
}: {
  watches: Watch[] | null;
  onWatch: (name: string) => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, NameCheck>>({});

  async function remove(n: string) {
    if (confirming !== n) {
      setConfirming(n); // two taps — no accidental unwatching
      setTimeout(() => setConfirming((c) => (c === n ? null : c)), 3000);
      return;
    }
    setConfirming(null);
    await fetch("/api/artist/watches", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n }),
    }).catch(() => {});
    onChanged();
  }

  async function checkName(n: string) {
    setChecks((c) => ({ ...c, [n]: { kind: "checking" } }));
    try {
      const res = await fetch(`/api/artist/name?name=${encodeURIComponent(n)}`);
      const data = await res.json();
      if (!data.ok) {
        setChecks((c) => ({ ...c, [n]: { kind: "idle" } }));
        return;
      }
      if (!data.configured) setChecks((c) => ({ ...c, [n]: { kind: "nonode" } }));
      else if (!data.reachable)
        setChecks((c) => ({ ...c, [n]: { kind: "unreachable", reason: data.reason ?? "" } }));
      else
        setChecks((c) => ({
          ...c,
          [n]: { kind: "known", status: data.status, detail: data.detail ?? "" },
        }));
    } catch {
      setChecks((c) => ({ ...c, [n]: { kind: "idle" } }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-2 border-edge bg-panel p-5">
        <p className="mb-3 font-pixel text-xs text-cyan">WATCH YOUR NAME</p>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            maxLength={63}
            spellCheck={false}
            placeholder="name (no @ needed)"
            className="min-w-0 flex-1 border-2 border-edge bg-void px-3 py-2 font-mono text-sm text-cyan placeholder:text-white/25 focus:border-cyan focus:outline-none"
            aria-label="Add a space name to your watchlist"
          />
          <button
            onClick={() => {
              if (!name.trim()) return;
              onWatch(name.trim());
              setName("");
            }}
            className="button shrink-0 !px-4 !py-2 !text-xs"
          >
            ＋ WATCH
          </button>
        </div>
        <p className="mt-3 font-body text-xs text-white/50">
          Watches ride your key — sign in anywhere and the list follows. CHECK asks the node for a
          name&apos;s latest on-chain state.
        </p>
      </div>

      {!watches || watches.length === 0 ? (
        <p className="font-body text-sm text-white/50">
          {watches
            ? "Nothing watched yet — star a name on the auction board, or add one above."
            : "Reading your watchlist…"}
        </p>
      ) : (
        <div className="border-2 border-edge">
          {watches.map((w) => {
            const line = checks[w.name] ? checkLine(checks[w.name]) : null;
            return (
              <div key={w.name} className="border-b border-edge px-4 py-3 last:border-b-0">
                <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                  <span className="font-arcade text-base text-cyan">@{w.name}</span>
                  <span className="text-white/40">{bftStamp(w.addedAt, w.blockHeight)}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => checkName(w.name)}
                      className="min-h-9 border-2 border-edge px-2 font-pixel text-[9px] uppercase text-white/40 hover:border-cyan hover:text-cyan"
                    >
                      CHECK
                    </button>
                    <button
                      onClick={() => remove(w.name)}
                      title="stop watching this name"
                      className={`min-h-9 border-2 px-2 font-pixel text-[9px] uppercase ${
                        confirming === w.name
                          ? "border-ghost text-ghost"
                          : "border-edge text-white/40 hover:border-ghost hover:text-ghost"
                      }`}
                    >
                      {confirming === w.name ? "SURE? 🗑" : "🗑"}
                    </button>
                  </div>
                </div>
                {line && checks[w.name]?.kind !== "idle" && (
                  <p className={`mt-2 font-pixel text-[10px] ${line.cls}`}>{line.text}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
