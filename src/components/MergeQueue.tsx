"use client";

import { useCallback, useEffect, useState } from "react";
import Notice from "@/components/Notice";

/**
 * The merge queue — SCAR's authorize-with-key lane. Each open PR gets one
 * button: sign `PACS-MERGE-<pr>-<headSha>-<ts>` with the operator key. The
 * signature binds the exact commit (a moved branch voids it), is verified
 * against the allowlist server-side, recorded as the audit trail, and — when
 * the deployment has a GITHUB_TOKEN — executes the merge right here.
 */

interface OpenPr {
  number: number;
  title: string;
  branch: string;
  headSha: string;
  url: string;
  draft: boolean;
}
interface MergeAuth {
  pr: number;
  headSha: string;
  by: string;
  at: string;
  merged: boolean;
  mergeNote?: string;
}
interface PrFile {
  file: string;
  status: string;
  additions: number;
  deletions: number;
}

/** GitHub's expiry header ("2026-10-09 14:30:00 UTC") → Date, or null. */
function parseExpiry(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s.replace(" UTC", "Z").replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

export default function MergeQueue() {
  const [prs, setPrs] = useState<OpenPr[] | null>(null);
  const [auths, setAuths] = useState<MergeAuth[]>([]);
  const [canExecute, setCanExecute] = useState(false);
  const [setup, setSetup] = useState<string | null>(null);
  const [busyPr, setBusyPr] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [changes, setChanges] = useState<Record<number, PrFile[] | "loading">>({});

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/admin/merges");
      const data = await res.json();
      if (!data.ok) {
        setErr(data.reason ?? "couldn't read the queue");
        return;
      }
      setPrs(data.prs);
      setAuths(data.auths);
      setCanExecute(data.canExecute);
      setSetup(data.setup ?? null);
      setExpiresAt(data.tokenExpiresAt ?? null);
    } catch {
      setErr("couldn't reach the app — try again");
    }
  }, []);

  /** ▸ CHANGES — the proposal's touched files, fetched once per open. */
  async function toggleChanges(pr: number) {
    if (changes[pr]) {
      setChanges((p) => {
        const next = { ...p };
        delete next[pr];
        return next;
      });
      return;
    }
    setChanges((p) => ({ ...p, [pr]: "loading" }));
    try {
      const res = await fetch(`/api/admin/merges?files=${pr}`);
      const data = await res.json();
      setChanges((p) => ({ ...p, [pr]: data.ok ? data.files : [] }));
    } catch {
      setChanges((p) => ({ ...p, [pr]: [] }));
    }
  }

  const expiry = parseExpiry(expiresAt);
  const daysLeft = expiry ? Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86400000)) : null;

  /** The renewal event, as a file — works in every calendar app on earth. */
  function downloadRenewalIcs() {
    if (!expiry) return;
    const remind = new Date(expiry.getTime() - 7 * 86400000);
    const d8 = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//frens.earth//SCARLET//EN",
      "BEGIN:VEVENT",
      `UID:scarlet-key-${d8(expiry)}@frens.earth`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d8(remind)}`,
      "SUMMARY:SCARLET — renew the GitHub key (7 days left)",
      `DESCRIPTION:RTFM 002 · phase 06 — make a fresh fine-grained token and paste it at /a/scar. The old key expires ${expiry.toISOString().slice(0, 10)}.`,
      "BEGIN:VALARM",
      "TRIGGER:-PT9H",
      "ACTION:DISPLAY",
      "DESCRIPTION:renew the GitHub key",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "scarlet-key-renewal.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    load();
  }, [load]);

  async function authorize(pr: OpenPr) {
    setErr(null);
    setNote(null);
    if (!window.nostr?.signEvent) {
      setErr("no signer extension found — the authorization is your signature");
      return;
    }
    setBusyPr(pr.number);
    let event;
    try {
      event = await window.nostr.signEvent({
        kind: 22242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: `PACS-MERGE-${pr.number}-${pr.headSha}-${Date.now()}`,
      });
    } catch {
      setErr("signing was declined — nothing sent");
      setBusyPr(null);
      return;
    }
    try {
      const res = await fetch("/api/admin/merges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setErr(data?.reason ?? `the server hiccuped (HTTP ${res.status}) — your signature was fine`);
        return;
      }
      setNote(`PR #${data.pr}: ${data.note}`);
      load();
    } catch {
      setErr("couldn't reach the server — check your connection and try again");
    } finally {
      setBusyPr(null);
    }
  }

  const authFor = (pr: OpenPr) => auths.filter((a) => a.pr === pr.number).at(-1);

  return (
    <div className="mx-auto mb-10 max-w-3xl px-6">
      <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
        SCAR ▸ MERGE QUEUE — YOUR SIGNATURE IS THE AUTHORIZATION
      </p>
      {expiry && daysLeft !== null && (
        <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase">
          <span className={daysLeft <= 14 ? "text-ghost" : "text-white/40"}>
            key expires in ~{daysLeft} days · ▣ ~{(daysLeft * 144).toLocaleString()} blocks
          </span>
          <button
            onClick={downloadRenewalIcs}
            className="border border-edge px-2 py-0.5 text-cyan hover:border-cyan"
          >
            ⤓ calendar (.ics)
          </button>
        </p>
      )}
      {err && <p className="mb-3 font-pixel text-[10px] uppercase text-ghost">{err}</p>}
      {note && <p className="mb-3 font-pixel text-[10px] uppercase text-neon">{note}</p>}
      {!prs ? (
        <p className="font-body text-sm text-white/50">Reading the queue…</p>
      ) : setup === "connect-github" ? (
        /* paste the token right here — same pattern as the node URL boxes */
        <ConnectGithub onConnected={load} />
      ) : setup ? (
        <Notice id="github-reach">{setup}</Notice>
      ) : prs.length === 0 ? (
        <p className="border-2 border-edge bg-panel p-4 font-body text-sm text-white/60">
          Nothing waiting to merge — the board is clean. 🌱
        </p>
      ) : (
        <div className="space-y-2">
          {prs.map((pr) => {
            const a = authFor(pr);
            return (
              <div key={pr.number} className="border-2 border-edge bg-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-white/40">
                      #{pr.number} · {pr.branch} · {pr.headSha.slice(0, 7)}
                      {pr.draft && <span className="ml-2 text-coin">DRAFT</span>}
                    </p>
                    <p className="mt-1 font-body text-sm text-white/90">{pr.title}</p>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <button
                      onClick={() => toggleChanges(pr.number)}
                      className="border-2 border-edge px-3 py-1.5 font-pixel text-[9px] uppercase text-cyan hover:border-cyan"
                    >
                      {changes[pr.number] ? "▾" : "▸"} CHANGES
                    </button>
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border-2 border-edge px-3 py-1.5 font-pixel text-[9px] uppercase text-white/60 hover:text-white/90"
                    >
                      GITHUB ▸
                    </a>
                    <button
                      onClick={() => authorize(pr)}
                      disabled={busyPr === pr.number}
                      className="border-2 border-coin px-3 py-1.5 font-pixel text-[9px] uppercase text-coin hover:glow-coin disabled:opacity-50"
                    >
                      {busyPr === pr.number
                        ? "SIGNING…"
                        : canExecute
                          ? "✍ AUTHORIZE & MERGE"
                          : "✍ AUTHORIZE"}
                    </button>
                  </div>
                </div>
                {changes[pr.number] === "loading" && (
                  <p className="mt-2 font-mono text-[10px] text-white/40">reading the changes…</p>
                )}
                {Array.isArray(changes[pr.number]) && (
                  /* the change list, VS-Code style — what the signature approves */
                  <div className="mt-3 border-t border-edge pt-2">
                    {(changes[pr.number] as PrFile[]).length === 0 ? (
                      <p className="font-mono text-[10px] text-white/40">
                        couldn&apos;t read the change list — review on GitHub ▸
                      </p>
                    ) : (
                      (changes[pr.number] as PrFile[]).map((f) => {
                        const base = f.file.split("/").pop() ?? f.file;
                        const dir = f.file.slice(0, f.file.length - base.length);
                        const letter =
                          f.status === "added" ? "A" : f.status === "removed" ? "D" : f.status === "renamed" ? "R" : "M";
                        const tone =
                          letter === "A" ? "text-neon" : letter === "D" ? "text-ghost" : "text-cyan";
                        return (
                          <div key={f.file} className="flex items-center gap-2 py-0.5 font-mono text-[11px]">
                            <span className={`w-3 flex-none text-center font-bold ${tone}`}>{letter}</span>
                            <span className="min-w-0 flex-1 truncate">
                              <span className="text-white/85">{base}</span>
                              {dir && <span className="ml-2 text-white/35">{dir}</span>}
                            </span>
                            <span className="flex-none text-neon">+{f.additions}</span>
                            <span className="flex-none text-ghost">−{f.deletions}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
                {a && (
                  <p className="mt-2 font-mono text-[10px] text-neon">
                    ✓ authorized by {a.by.slice(0, 8)}… · {a.merged ? "merged" : a.mergeNote}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!canExecute && prs && prs.length > 0 && (
        <p className="mt-2 font-body text-xs text-white/40">
          Signatures are recorded as the sign-off; connect a GitHub token and the button merges
          right here.
        </p>
      )}
    </div>
  );
}

/** The connect box — paste a fine-grained PAT (contents + pull-requests
    write, this repo only), save write-once, and the queue lights up. The
    token is masked forever after; no deployment env required.

    On connect, SCARLET runs THE HANDSHAKE in front of the captain — each
    stage is a real check, shown as manual-style flow boxes (equal grid,
    chip top-left, label stacked — the house box standard), ending with a
    plain-words "you did great". The training dashboard's first instance. */

type StageState = "wait" | "run" | "done" | "fail";
const STAGE_LABELS = ["key received", "reaching github", "queue online"] as const;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ConnectGithub({ onConnected }: { onConnected: () => void }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [stages, setStages] = useState<StageState[] | null>(null);
  const [prCount, setPrCount] = useState<number | null>(null);
  const [great, setGreat] = useState(false);

  const setStage = (i: number, s: StageState) =>
    setStages((prev) => prev?.map((v, j) => (j === i ? s : j === i + 1 && s === "done" ? "run" : v)) ?? prev);

  async function connect() {
    setErr(null);
    if (!token.trim()) {
      setErr("paste a token first");
      return;
    }
    setBusy(true);
    setGreat(false);
    setStages(["run", "wait", "wait"]);
    try {
      // stage 1 — the key lands in the vault (write-only)
      const res = await fetch("/api/admin/nodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubToken: token.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setStage(0, "fail");
        setErr(data.reason ?? "couldn't save the key");
        return;
      }
      setToken("");
      await pause(600);
      setStage(0, "done"); // advances stage 2 to "run"

      // stages 2 + 3 — the key actually opens the repo and lists the queue
      const check = await fetch("/api/admin/merges");
      const queue = await check.json().catch(() => null);
      if (!queue?.ok || queue.setup) {
        setStage(1, "fail");
        setErr(
          queue?.setup === "connect-github"
            ? "the key saved, but GitHub didn't answer to it — check the resource owner (the org), repo access, and Contents + Pull requests (read/write)"
            : (queue?.setup ?? queue?.reason ?? "GitHub didn't answer — try again"),
        );
        return;
      }
      await pause(600);
      setStage(1, "done");
      await pause(600);
      setPrCount(Array.isArray(queue.prs) ? queue.prs.length : 0);
      setStage(2, "done");
      setGreat(true);
      await pause(4200); // let the moment land, then the live queue takes over
      onConnected();
    } catch {
      setStages(null);
      setErr("couldn't reach the server — check your connection and try again");
    } finally {
      setBusy(false);
    }
  }

  const stageStyle: Record<StageState, string> = {
    wait: "border-edge text-white/30",
    run: "border-cyan text-cyan animate-pulse",
    done: "border-neon text-neon",
    fail: "border-ghost text-ghost",
  };
  const stageMark: Record<StageState, string> = { wait: "", run: "▸ ", done: "✓ ", fail: "✗ " };

  return (
    <div className="border-2 border-coin/60 bg-coin/5 p-4">
      <p className="mb-2 font-pixel text-[10px] uppercase text-coin">CONNECT YOUR GITHUB — PASTE, SAVE, APPROVE</p>
      {!stages && (
        <p className="mb-3 font-body text-xs text-white/70">
          The repo is private, so the queue needs a key to see it. GitHub → Settings → Developer
          settings →{" "}
          <a
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan underline hover:text-white"
          >
            Fine-grained tokens ▸
          </a>
          : name under 40 chars, resource owner = <span className="text-cyan">your org</span>, this
          repo only, permissions <span className="text-cyan">Contents + Pull requests (read/write)</span>.
          Paste it once — it&apos;s stored write-only and never shown again.
        </p>
      )}

      {/* THE HANDSHAKE — three real checks the captain watches happen */}
      {stages && (
        <div className="mb-3 grid grid-cols-1 items-stretch gap-2 sm:grid-cols-[1fr_16px_1fr_16px_1fr]">
          {stages.map((s, i) => (
            <FragmentedStage key={STAGE_LABELS[i]} index={i} state={s} style={stageStyle[s]} mark={stageMark[s]} />
          ))}
        </div>
      )}

      {great && (
        <div className="mb-3 border-2 border-neon bg-neon/10 p-4">
          <p className="font-pixel text-[11px] uppercase tracking-widest text-neon">
            ✓ YOU DID GREAT, CAPTAIN.
          </p>
          <p className="mt-2 font-body text-sm text-white/85">
            Key received. GitHub answered.{" "}
            {prCount === 0
              ? "The board is clean — proposals will line up here."
              : `${prCount} proposal${prCount === 1 ? "" : "s"} waiting for your signature.`}{" "}
            SCARLET has the conn.
          </p>
        </div>
      )}

      {!great && (
        <div className="flex flex-wrap gap-2">
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            type="password"
            placeholder="github_pat_…"
            disabled={busy}
            className="min-w-0 flex-1 border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-cyan placeholder:text-white/25 focus:border-cyan focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={connect}
            disabled={busy}
            className="min-h-11 border-2 border-coin px-4 font-pixel text-[9px] uppercase text-coin hover:glow-coin disabled:opacity-50"
          >
            {busy ? "SHAKING HANDS…" : "▶ CONNECT"}
          </button>
        </div>
      )}
      {err && <p className="mt-2 font-pixel text-[9px] uppercase text-ghost">{err}</p>}
    </div>
  );
}

/** One handshake box + its leading arrow (skipped for the first). Equal grid
    cells, chip top-left, label stacked — docs/glyph box standard. */
function FragmentedStage({
  index,
  state,
  style,
  mark,
}: {
  index: number;
  state: StageState;
  style: string;
  mark: string;
}) {
  return (
    <>
      {index > 0 && (
        <span className="hidden place-self-center font-mono text-[11px] text-white/30 sm:grid">▶</span>
      )}
      <div className={`flex flex-col gap-1 border-2 bg-panel p-2.5 ${style}`}>
        <span className="font-mono text-[8px] uppercase tracking-widest opacity-60">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="font-pixel text-[9px] uppercase">
          {mark}
          {STAGE_LABELS[index]}
          {state === "run" && "…"}
        </span>
      </div>
    </>
  );
}
