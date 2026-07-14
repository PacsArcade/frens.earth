"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Notice from "@/components/Notice";

/**
 * The merge queue — SCAR's authorize-with-key lane. Each open PR gets one
 * button: sign `PACS-MERGE-<pr>-<headSha>-<ts>` with the operator key. The
 * signature binds the exact commit (a moved branch voids it), is verified
 * against the allowlist server-side, recorded as the audit trail, and — when
 * the deployment has a GITHUB_TOKEN — executes the merge right here.
 *
 * ✎ NOTE rides the same rails: sign `PACS-NOTE-<pr>-<ts>\n<body>` (the
 * signature covers the note's exact words), the server verifies + records
 * it, and — token connected — posts it onto the PR's GitHub conversation
 * with a footer citing the signature.
 *
 * ONE PANEL, THE FULL LIFECYCLE (merge → ship → live → test): `mode` picks
 * which stages render.
 *   • "approvals" (Action Items) — open PRs (① AUTHORIZE & MERGE active, ②
 *     SHIP locked) PLUS merged-but-NOT-live changes (① MERGE ✓, ② SHIP lit).
 *     A card's SHIP signs `PACS-DEPLOY` and fires the deploy hook, then polls
 *     the server build stamp to flip the card MERGED → LIVE.
 *   • "testing" (Bug Testing) — ONLY merged + LIVE changes (the "◉ DEPLOYED —
 *     TEST NOW" card, SUBMIT A BUG / CLOSE OUT), unchanged.
 * The live/not-live split is the existing build-stamp compare: a merge whose
 * timestamp predates the running build is live; a not-live merge is a ship
 * stage on Action Items, a live merge is a test stage on Bug Testing.
 * Every signing/authorize/close-out/note path is untouched.
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
  closed?: boolean;
  kind?: "note"; // absent = merge authorization
  note?: string; // the note body, exactly as signed
  shipped?: boolean; // ▲ SHIPped — merge ≠ live, so the card stays until this
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

/** Render a PR brief with clickable links — markdown `[label](url)` and bare
    https URLs become NEW-TAB links, so the admiral can open the doc / RTFM item
    to review, then come back and sign off. Everything else stays plain text
    (the container keeps whitespace-pre-wrap, so line breaks survive). */
function linkifyBrief(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const href = (m[2] ?? m[3]) as string;
    const label = (m[1] ?? m[3]) as string;
    out.push(
      <a
        key={key++}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="break-words text-cyan underline underline-offset-2 hover:text-white"
      >
        {label}
      </a>,
    );
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** The lifecycle strip — MERGE → SHIP → LIVE → TEST, with completed stages
    checked (neon), the current stage filled (its own semantic colour: MERGE
    verifies = cyan, everything downstream = live/neon), the rest hollow. Ties
    the whole card to the one journey a change takes. */
const STAGES = ["MERGE", "SHIP", "LIVE", "TEST"] as const;
function StageStrip({ current, busy }: { current: number; busy?: boolean }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[9px] uppercase tracking-widest">
      {STAGES.map((s, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending";
        // the active stage can be mid-flight (a merge/deploy in progress) — a
        // pulsing ◐ + trailing … reads as "working" without a new colour token.
        const working = busy && state === "active";
        const mark = state === "done" ? "✓" : working ? "◐" : state === "active" ? "●" : "○";
        const tone =
          state === "pending"
            ? "text-white/25"
            : state === "done"
              ? "text-neon"
              : i === 0
                ? "text-cyan"
                : "text-neon";
        return (
          <span key={s} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-white/20" aria-hidden>→</span>}
            <span className={`${tone}${working ? " animate-pulse" : ""}`}>
              {mark} {s}
              {working ? "…" : ""}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default function MergeQueue({ mode }: { mode?: "approvals" | "testing" }) {
  const [prs, setPrs] = useState<OpenPr[] | null>(null);
  const [auths, setAuths] = useState<MergeAuth[]>([]);
  const [canExecute, setCanExecute] = useState(false);
  const [setup, setSetup] = useState<string | null>(null);
  const [busyPr, setBusyPr] = useState<number | null>(null);
  /* optimistic MERGING — the PRs whose merge the operator just authorized. The
     card flips to a MERGING… indicator the instant they sign, before the API
     answers, and holds it until load() carries the card into the ship stage. */
  const [merging, setMerging] = useState<Set<number>>(new Set());
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  /* the repo slug — builds REVIEW ON GITHUB doors for merged cards (their
     records carry only the PR number, not the PR url) */
  const [repo, setRepo] = useState<string | null>(null);
  const [changes, setChanges] = useState<Record<number, PrFile[] | "loading">>({});
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [noteBusy, setNoteBusy] = useState<number | null>(null);

  /* SHIP — the deploy stage, folded onto the merge card. `serverBuiltAt` is the
     build stamp the API reports per-request (it moves when the new deploy is
     live, which the baked bundle stamp can't); `deploying` is a ship in flight
     (all merged-pending cards ride one deploy); `wentLive` marks the cards this
     session watched cross MERGED → LIVE so we can show the ✓ before they leave. */
  const [deployConfigured, setDeployConfigured] = useState<boolean | null>(null);
  const [serverBuiltAt, setServerBuiltAt] = useState<string | null>(null);
  const [shipBusy, setShipBusy] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [wentLive, setWentLive] = useState<Set<number>>(new Set());
  const [shippedThisSession, setShippedThisSession] = useState<Set<number>>(new Set());

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
      if (typeof data.repo === "string" && data.repo) setRepo(data.repo);
      if (typeof data.builtAt === "string") setServerBuiltAt(data.builtAt);
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
      "PRODID:-//frens.earth//SCAR-LET//EN",
      "BEGIN:VEVENT",
      `UID:scarlet-key-${d8(expiry)}@frens.earth`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d8(remind)}`,
      "SUMMARY:SCAR·LET — renew the GitHub key (7 days left)",
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

  /* SHIP lives only on Action Items — learn whether the deploy hook is wired so
     a lit SHIP either ships or points to Connections to connect one. */
  useEffect(() => {
    if (mode === "testing") return;
    (async () => {
      try {
        const res = await fetch("/api/admin/deploy");
        if (res.status === 401) {
          setDeployConfigured(false);
          return;
        }
        const d = await res.json().catch(() => null);
        setDeployConfigured(!!d?.configured);
      } catch {
        setDeployConfigured(null);
      }
    })();
  }, [mode]);

  /* IN FLIGHT — the admiral's rule: a signature OPENS a change; it stays on
     the queue through deploy → test → bug-or-close, and only the close-out
     clears it. "Deployed?" is answered honestly: the running build's stamp vs
     the signature's timestamp (a new build IS the deploy on this ship). We
     prefer the server-reported stamp (moves after a ship) over the baked one. */
  const bakedBuiltAt = process.env.NEXT_PUBLIC_BUILD_AT ?? "";
  const builtAt = serverBuiltAt || bakedBuiltAt;
  const isLive = (x: MergeAuth) => !!builtAt && x.at < builtAt;
  /* merge ≠ live: a change only leaves Action Items once the operator has
     explicitly ▲ SHIPped it. `shipped` is the persisted flag; records that
     predate it fall back to the old build-stamp check so already-deployed
     changes stay in Bug Testing. A NOT-yet-shipped merge stays on the ship
     stage no matter what the build stamp says — an unrelated redeploy can't
     yank it off the board anymore. */
  const isShipped = (x: MergeAuth) => x.shipped === true || (x.shipped === undefined && isLive(x));
  const deployedLive = (x: MergeAuth) => isShipped(x) && isLive(x);

  const latestByPr = new Map<number, MergeAuth>();
  for (const x of auths) if (!x.closed && x.kind !== "note") latestByPr.set(x.pr, x);
  const inFlight = [...latestByPr.values()].filter(
    (x) => x.merged && !(prs ?? []).some((p) => p.number === x.pr),
  );

  /* the placement rule — merged-but-not-(shipped-and-live) → Action Items (ship
     stage: SHIP lit, or DEPLOYING while the build catches up); shipped + live →
     Bug Testing (test stage). A card the session just watched go live lingers on
     Action Items with a LIVE ✓ until the next load carries it over. */
  const shipStage = inFlight.filter((x) => !deployedLive(x) || wentLive.has(x.pr));
  const testStage = inFlight.filter((x) => deployedLive(x));
  /* a shipped change whose build hasn't overtaken it yet — keep the live-watch
     polling even across a reload (deploying is session-only; shipped persists). */
  const awaitingLive = inFlight.some((x) => x.shipped === true && !isLive(x));

  /* poll the queue (~every 12s, capped ~2.5 min per run) while a ship is in
     flight — this session (`deploying`) OR a persisted shipped-but-not-live
     record (`awaitingLive`, so the watch resumes after a reload) — so the
     server build stamp, and with it MERGED → LIVE, updates without a manual
     reload. Don't hammer; stop the moment there's nothing left to watch. */
  useEffect(() => {
    if (!deploying && !awaitingLive) return;
    let ticks = 0;
    const iv = setInterval(() => {
      ticks += 1;
      load();
      if (ticks >= 12) {
        clearInterval(iv);
        setDeploying(false);
      }
    }, 12000);
    return () => clearInterval(iv);
  }, [deploying, awaitingLive, load]);

  /* detect the crossing: for each change this session shipped, once the running
     build post-dates its merge, mark it LIVE ✓ and end the deploy watch. */
  useEffect(() => {
    if (shippedThisSession.size === 0 || !builtAt) return;
    const newlyLive: number[] = [];
    let allLive = true;
    for (const pr of shippedThisSession) {
      const a = latestByPr.get(pr);
      const live = !!a && a.merged && a.at < builtAt;
      if (live && !wentLive.has(pr)) newlyLive.push(pr);
      if (!live) allLive = false;
    }
    if (newlyLive.length > 0) {
      setWentLive((prev) => new Set([...prev, ...newlyLive]));
    }
    if (allLive) setDeploying(false);
    // latestByPr is derived from auths; builtAt from serverBuiltAt — both listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auths, builtAt, shippedThisSession]);

  async function closeOut(pr: number) {
    setErr(null);
    try {
      const res = await fetch("/api/admin/merges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ close: pr }),
      });
      const data = await res.json().catch(() => null);
      if (data?.ok) load();
      else setErr("couldn't close the change — try again");
    } catch {
      setErr("couldn't reach the server — try again");
    }
  }

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
    /* authorized — flip the card to MERGING… now, before the API answers, so the
       merge never looks like it vanished mid-flight. */
    const clearMerging = () =>
      setMerging((prev) => {
        const next = new Set(prev);
        next.delete(pr.number);
        return next;
      });
    setMerging((prev) => new Set(prev).add(pr.number));
    try {
      const res = await fetch("/api/admin/merges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setErr(data?.reason ?? `the server hiccuped (HTTP ${res.status}) — your signature was fine`);
        clearMerging();
        return;
      }
      setNote(`PR #${data.pr}: ${data.note}`);
      /* let load() carry the card from the open list into the ship stage, then
         drop the optimistic flag — the retained merged record holds it now. */
      await load();
      clearMerging();
    } catch {
      setErr("couldn't reach the server — check your connection and try again");
      clearMerging();
    } finally {
      setBusyPr(null);
    }
  }

  /** ② ▲ SHIP — the deploy stage, on the card. Reuses the exact PACS-DEPLOY
      flow (sign `PACS-DEPLOY-<ts>`, POST `{ event }`, the server verifies +
      fires the Vercel hook) — the same ladder DeployPanel uses, no duplicate
      signing logic. One ship deploys the current `main`, which carries EVERY
      merged-pending change; they all advance to Bug Testing when it goes live.
      Then the deploy watch polls the build stamp until MERGED → LIVE. */
  async function shipAll() {
    setErr(null);
    setNote(null);
    if (!window.nostr?.signEvent) {
      setErr("no signer extension found — your signature is the authorization");
      return;
    }
    setShipBusy(true);
    let event;
    try {
      event = await window.nostr.signEvent({
        kind: 22242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: `PACS-DEPLOY-${Date.now()}`,
      });
    } catch {
      setErr("signing was declined — nothing shipped");
      setShipBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setErr(data?.reason ?? `the server hiccuped (HTTP ${res.status}) — your signature was fine`);
        return;
      }
      setNote("▲ shipping all merged changes to production — watching for LIVE…");
      const shippedPrs = shipStage.map((x) => x.pr);
      setShippedThisSession(new Set(shippedPrs));
      setDeploying(true);
      /* stamp the records shipped so the cards stay put (merge ≠ live) and
         survive a reload until the build stamp carries them to Bug Testing. */
      fetch("/api/admin/merges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ship: shippedPrs }),
      })
        .then(() => load())
        .catch(() => {});
    } catch {
      setErr("couldn't reach the server — check your connection and try again");
    } finally {
      setShipBusy(false);
    }
  }

  /** ✎ NOTE — the row's signed comment box, collapsible like ▸ CHANGES. */
  /** ▸ WHAT TO TEST — the change's own brief (PR title+body), fetched once. */
  const [briefs, setBriefs] = useState<Record<number, { title: string; body: string } | "loading">>({});
  async function toggleBrief(pr: number) {
    if (briefs[pr]) {
      setBriefs((p) => {
        const next = { ...p };
        delete next[pr];
        return next;
      });
      return;
    }
    setBriefs((p) => ({ ...p, [pr]: "loading" }));
    try {
      const res = await fetch(`/api/admin/merges?brief=${pr}`);
      const data = await res.json();
      setBriefs((p) => ({
        ...p,
        [pr]: data.ok ? { title: data.title, body: data.body } : { title: "", body: "couldn't read the brief — see it on GitHub" },
      }));
    } catch {
      setBriefs((p) => ({ ...p, [pr]: { title: "", body: "couldn't reach the server — try again" } }));
    }
  }

  function toggleNote(pr: number) {
    setDrafts((p) => {
      const next = { ...p };
      if (pr in next) delete next[pr];
      else next[pr] = "";
      return next;
    });
  }

  /** Sign the note's exact words with the operator key and hand it to the
      server: verified, recorded, and — token connected — posted onto the
      PR's GitHub conversation with the signature cited in the footer. */
  async function signAndPostNote(pr: number) {
    setErr(null);
    setNote(null);
    const text = (drafts[pr] ?? "").trim();
    if (!text) {
      setErr("write the note first — the signature covers its exact words");
      return;
    }
    if (!window.nostr?.signEvent) {
      setErr("no signer extension found — the note is your signature");
      return;
    }
    setNoteBusy(pr);
    let event;
    try {
      event = await window.nostr.signEvent({
        kind: 22242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: `PACS-NOTE-${pr}-${Date.now()}\n${text}`,
      });
    } catch {
      setErr("signing was declined — nothing sent");
      setNoteBusy(null);
      return;
    }
    try {
      const res = await fetch("/api/admin/merges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: event }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setErr(data?.reason ?? `the server hiccuped (HTTP ${res.status}) — your signature was fine`);
        return;
      }
      setNote(`PR #${data.pr}: note ${data.note}`);
      setDrafts((p) => {
        const next = { ...p };
        delete next[pr];
        return next;
      });
      load();
    } catch {
      setErr("couldn't reach the server — check your connection and try again");
    } finally {
      setNoteBusy(null);
    }
  }

  const authFor = (pr: OpenPr) =>
    auths.filter((a) => a.pr === pr.number && a.kind !== "note").at(-1);
  const notesFor = (pr: number) => auths.filter((a) => a.pr === pr && a.kind === "note");

  /** The change's own brief expando — shared by ship + test stage cards. */
  function briefBlock(pr: number) {
    return (
      <>
        {briefs[pr] === "loading" && (
          <p className="mt-2 font-mono text-[10px] text-white/40">reading the brief…</p>
        )}
        {briefs[pr] && briefs[pr] !== "loading" && (
          <div className="mt-3 border-t border-edge pt-2">
            {(briefs[pr] as { title: string }).title && (
              <p className="mb-1 font-body text-base text-white/90">
                {(briefs[pr] as { title: string }).title}
              </p>
            )}
            <p className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-white/80">
              {(briefs[pr] as { body: string }).body
                ? linkifyBrief((briefs[pr] as { body: string }).body)
                : "the proposal carried no brief — test what the title promises, and say so in feedback"}
            </p>
          </div>
        )}
      </>
    );
  }

  /** The signed-feedback expando — shared by ship + test stage cards. */
  function feedbackBlock(pr: number) {
    if (!(pr in drafts)) return null;
    return (
      <div className="mt-3 border-t border-edge pt-3">
        <textarea
          value={drafts[pr]}
          onChange={(e) => setDrafts((p) => ({ ...p, [pr]: e.target.value }))}
          rows={3}
          placeholder="what you saw, what you'd change — your key signs these exact words"
          className="w-full rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-white/85 placeholder:text-white/25 focus:border-pink focus:outline-none"
        />
        <button
          onClick={() => signAndPostNote(pr)}
          disabled={noteBusy === pr}
          data-accent="pink"
          className="btn-pill mt-2"
        >
          {noteBusy === pr ? "SIGNING…" : "✍ SIGN & POST FEEDBACK"}
        </button>
      </div>
    );
  }

  /** ② SHIP control on a ship-stage card. No hook wired → point at Connections;
      wired → the lit, signing SHIP (or its deploying / live successors). A card
      whose record is already `shipped` shows DEPLOYING even after a reload. */
  function shipControl(x: MergeAuth, justLive: boolean) {
    if (justLive) {
      return (
        <span className="btn-pill btn-pill--solid" data-accent="neon" aria-disabled>
          ◉ LIVE ✓
        </span>
      );
    }
    if (deployConfigured === false) {
      return (
        <a href="/a/connections#deploy" className="btn-pill" data-accent="neon">
          ② ▲ CONNECT A DEPLOY HOOK →
        </a>
      );
    }
    if (isShipped(x) || deploying) {
      return (
        <button disabled className="btn-pill btn-pill--solid" data-accent="neon">
          ▲ DEPLOYING…
        </button>
      );
    }
    return (
      <button
        onClick={shipAll}
        disabled={shipBusy}
        data-accent="neon"
        className="btn-pill btn-pill--solid ship-lit"
      >
        {shipBusy ? "SIGNING…" : "② ▲ SHIP"}
      </button>
    );
  }

  /** A merged change on the SHIP stage (Action Items): MERGE ✓ done, SHIP lit.
      Merge ≠ live — it holds here until the operator ▲ SHIPs it and the build
      goes live, at which point it crosses to Bug Testing. */
  function shipStageCard(x: MergeAuth) {
    const justLive = wentLive.has(x.pr);
    const shipping = isShipped(x) || deploying; // shipped & waiting for the build
    return (
      <div key={x.pr} className="console-card p-4" data-accent="neon">
        <StageStrip current={justLive ? 3 : shipping ? 2 : 1} busy={shipping && !justLive} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs tabular-nums text-white/40">
              #{x.pr} · signed by {x.by.slice(0, 8)}…
            </p>
            <p className={`mt-1 font-pixel text-[10px] uppercase ${justLive ? "text-neon" : "text-cyan"}`}>
              {justLive
                ? "◉ LIVE ✓ — now in Bug Testing"
                : shipping
                  ? "▲ shipping… — deploying to production, waiting to go live"
                  : "◌ merged — not live yet · ready to ship"}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button onClick={() => toggleBrief(x.pr)} className="btn-pill" data-accent="cyan">
              {briefs[x.pr] ? "▾" : "▸"} WHAT SHIPS
            </button>
            <button onClick={() => toggleNote(x.pr)} className="btn-pill" data-accent="pink">
              ✎ NOTE
            </button>
            {/* ② SHIP is a signature too — the review door rides this card */}
            {repo && (
              <a
                href={`https://github.com/${repo}/pull/${x.pr}`}
                target="_blank"
                rel="noopener noreferrer"
                title="open this PR on GitHub and read what ships before you sign"
                data-accent="cyan"
                className="btn-pill"
              >
                ⌕ REVIEW ON GITHUB
              </a>
            )}
            <span className="btn-pill btn-pill--muted" data-accent="neon" aria-disabled>
              ① ✓ MERGED
            </span>
            {shipControl(x, justLive)}
          </div>
        </div>
        {justLive ? (
          <p className="mt-2 font-mono text-[10px] text-neon">
            it&apos;s live — <a href="/a/testing" className="underline underline-offset-2 hover:text-white">test it in Bug Testing →</a>
          </p>
        ) : (
          <p className="mt-2 font-mono text-[10px] text-white/40">
            one ▲ SHIP deploys the current main — every merged-pending change goes live together.
          </p>
        )}
        {briefBlock(x.pr)}
        {feedbackBlock(x.pr)}
      </div>
    );
  }

  /** A merged + LIVE change on the TEST stage (Bug Testing) — unchanged. */
  function testStageCard(x: MergeAuth) {
    return (
      <div key={x.pr} className="console-card p-4" data-accent="neon">
        <StageStrip current={3} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs tabular-nums text-white/40">
              #{x.pr} · signed by {x.by.slice(0, 8)}…
            </p>
            <p className="mt-1 font-pixel text-[10px] uppercase text-neon">
              ◉ DEPLOYED — TEST NOW, ADMIRAL
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button onClick={() => toggleBrief(x.pr)} className="btn-pill" data-accent="cyan">
              {briefs[x.pr] ? "▾" : "▸"} WHAT TO TEST
            </button>
            <button onClick={() => toggleNote(x.pr)} className="btn-pill" data-accent="pink">
              ✎ FEEDBACK
            </button>
            {repo && (
              <a
                href={`https://github.com/${repo}/pull/${x.pr}`}
                target="_blank"
                rel="noopener noreferrer"
                title="the change on GitHub — what this deploy actually shipped"
                data-accent="cyan"
                className="btn-pill"
              >
                ⌕ REVIEW ON GITHUB
              </a>
            )}
            <a href={`/support?pr=${x.pr}`} className="btn-pill" data-accent="ghost">
              🐛 SUBMIT A BUG
            </a>
            <button
              onClick={() => closeOut(x.pr)}
              title="verified — end the watch"
              className="btn-pill btn-pill--solid"
              data-accent="neon"
            >
              ✓ CLOSE OUT
            </button>
          </div>
        </div>
        {briefBlock(x.pr)}
        {feedbackBlock(x.pr)}
      </div>
    );
  }

  return (
    <div className="mx-auto mb-10 max-w-3xl px-6">
      {mode !== "testing" && (
        <>
          <p className="lcars-eyebrow mb-3" data-accent="cyan">
            MERGE QUEUE · YOUR SIGNATURE IS THE AUTHORIZATION
          </p>
          {expiry && daysLeft !== null && (
            <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tabular-nums uppercase">
              <span className={daysLeft <= 14 ? "text-ghost" : "text-white/40"}>
                key expires in ~{daysLeft} days · ▣ ~{(daysLeft * 144).toLocaleString()} blocks
              </span>
              <button
                onClick={downloadRenewalIcs}
                className="rounded-full border border-edge px-3 py-1 text-cyan hover:border-cyan"
              >
                ⤓ calendar (.ics)
              </button>
            </p>
          )}
        </>
      )}
      {err && <p className="mb-3 font-pixel text-[10px] uppercase text-ghost">{err}</p>}
      {note && <p className="mb-3 font-pixel text-[10px] uppercase text-neon">{note}</p>}
      {mode !== "testing" && (!prs ? (
        <p className="font-body text-sm text-white/50">Reading the queue…</p>
      ) : setup === "connect-github" ? (
        /* paste the token right here — same pattern as the node URL boxes */
        <ConnectGithub onConnected={load} />
      ) : setup ? (
        <Notice id="github-reach">{setup}</Notice>
      ) : prs.length === 0 && shipStage.length === 0 ? (
        <p className="console-card p-4 font-body text-sm text-white/60">
          Nothing waiting to merge or ship — the board is clean. 🌱
        </p>
      ) : (
        <div className="space-y-2">
          {prs.map((pr) => {
            const a = authFor(pr);
            const merged = !!a?.merged;
            const isMerging = merging.has(pr.number); // optimistic, pre-API
            return (
              <div key={pr.number} className="console-card p-4" data-accent="cyan">
                <StageStrip current={merged ? 1 : 0} busy={isMerging && !merged} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs tabular-nums text-white/40">
                      #{pr.number} · {pr.branch} · {pr.headSha.slice(0, 7)}
                      {pr.draft && <span className="pill pill--muted ml-2">DRAFT</span>}
                    </p>
                    <p className="mt-1 font-body text-base text-white/90">{pr.title}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      onClick={() => toggleChanges(pr.number)}
                      className="btn-pill"
                      data-accent="cyan"
                    >
                      {changes[pr.number] ? "▾" : "▸"} CHANGES
                    </button>
                    <button
                      onClick={() => toggleNote(pr.number)}
                      className="btn-pill"
                      data-accent="pink"
                    >
                      {pr.number in drafts ? "▾" : "✎"} NOTE
                    </button>
                    {/* the review door — never muted: reading the diff on
                        GitHub is step zero of the signature (RTFM 007 rule 3) */}
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="open this PR on GitHub and read the diff before you sign"
                      data-accent="cyan"
                      className="btn-pill"
                    >
                      ⌕ REVIEW ON GITHUB
                    </a>
                    <button
                      onClick={() => authorize(pr)}
                      disabled={busyPr === pr.number || isMerging}
                      className="btn-pill btn-pill--solid"
                      data-accent="cyan"
                    >
                      {isMerging
                        ? "① ◐ MERGING…"
                        : busyPr === pr.number
                          ? "SIGNING…"
                          : merged
                            ? "① ✓ MERGED"
                            : canExecute
                              ? "① ✍ AUTHORIZE & MERGE"
                              : "① ✍ AUTHORIZE"}
                    </button>
                    {/* ② SHIP — present but locked until the merge lands */}
                    <button
                      disabled
                      title="ships after merge"
                      className="btn-pill"
                      data-accent="neon"
                    >
                      ② ▲ SHIP
                    </button>
                  </div>
                </div>
                <p className={`mt-2 font-mono text-[10px] ${isMerging ? "text-cyan animate-pulse" : "text-white/40"}`}>
                  {isMerging
                    ? "◐ merging… — the card stays right here, then ② ▲ SHIP lights up."
                    : "② ▲ SHIP unlocks the moment this merges — merge ≠ live until you ship."}
                </p>
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
                          <a
                            key={f.file}
                            href={`${pr.url.split("/pull/")[0]}/blob/${pr.headSha}/${f.file}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="open this file on GitHub to review"
                            className="flex items-center gap-2 rounded py-0.5 font-mono text-[12px] hover:bg-white/5"
                          >
                            <span className={`w-3 flex-none text-center font-bold ${tone}`}>{letter}</span>
                            <span className="min-w-0 flex-1 truncate">
                              <span className="text-white/85 underline-offset-2 hover:underline">{base}</span>
                              {dir && <span className="ml-2 text-white/35">{dir}</span>}
                            </span>
                            <span className="flex-none text-neon">+{f.additions}</span>
                            <span className="flex-none text-ghost">−{f.deletions}</span>
                          </a>
                        );
                      })
                    )}
                  </div>
                )}
                {pr.number in drafts && (
                  /* the signed note — your words, your key. The signature
                     covers the exact text; GitHub gets it as a PR comment
                     with the signature cited (or it records, honestly). */
                  <div className="mt-3 border-t border-edge pt-3">
                    <textarea
                      value={drafts[pr.number]}
                      onChange={(e) => setDrafts((p) => ({ ...p, [pr.number]: e.target.value }))}
                      rows={3}
                      disabled={noteBusy === pr.number}
                      placeholder="leave a note on this change — your key signs the exact words"
                      className="w-full rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-white/85 placeholder:text-white/25 focus:border-pink focus:outline-none disabled:opacity-50"
                    />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-[10px] text-white/40">
                        {canExecute
                          ? "lands on the PR's GitHub page, signature cited"
                          : "no GitHub key connected — the note records to the audit log"}
                      </p>
                      <button
                        onClick={() => signAndPostNote(pr.number)}
                        disabled={noteBusy === pr.number}
                        className="btn-pill"
                        data-accent="pink"
                      >
                        {noteBusy === pr.number ? "SIGNING…" : "✍ SIGN & POST"}
                      </button>
                    </div>
                    {notesFor(pr.number).length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-edge/50 pt-2">
                        {notesFor(pr.number).map((n, i) => (
                          <p key={i} className="font-mono text-[10px] text-white/40">
                            ✎ <span className="whitespace-pre-wrap text-white/70">{n.note}</span>{" "}
                            — {n.by.slice(0, 8)}… · {n.mergeNote}
                          </p>
                        ))}
                      </div>
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
      ))}

      {/* SHIP STAGE — merged, not live yet: MERGE ✓, SHIP lit (Action Items) */}
      {mode !== "testing" && shipStage.length > 0 && (
        <div className="mt-8">
          <p className="lcars-eyebrow mb-3" data-accent="neon">
            READY TO SHIP · MERGED — NOT LIVE YET
          </p>
          <div className="space-y-2">{shipStage.map((x) => shipStageCard(x))}</div>
        </div>
      )}

      {/* TEST STAGE — merged + LIVE: the deployed, test-it-now cards (Bug Testing) */}
      {mode !== "approvals" && testStage.length > 0 && (
        <div className="mt-8">
          <p className="lcars-eyebrow mb-3" data-accent="neon">
            IN FLIGHT · DEPLOYED — YOURS UNTIL YOU CLOSE IT OUT
          </p>
          <div className="space-y-2">{testStage.map((x) => testStageCard(x))}</div>
        </div>
      )}
      {mode === "testing" && testStage.length === 0 && (
        <p className="console-card p-4 font-body text-sm text-white/60" data-accent="neon">
          {!prs
            ? "Reading the queue…"
            : "Nothing deployed to test — merged changes appear here once they go live. 🌱"}
        </p>
      )}
      {mode !== "testing" && !canExecute && prs && prs.length > 0 && (
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

    On connect, SCAR·LET runs THE HANDSHAKE in front of the captain — each
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
    <div className="console-card p-4" data-accent="cyan">
      <p className="mb-2 font-pixel text-[10px] uppercase text-cyan">CONNECT YOUR GITHUB — PASTE, SAVE, APPROVE</p>
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
        <div className="mb-3 rounded-xl border-2 border-neon bg-neon/10 p-4">
          <p className="font-pixel text-[11px] uppercase tracking-widest text-neon">
            ✓ YOU DID GREAT, CAPTAIN.
          </p>
          <p className="mt-2 font-body text-sm text-white/85">
            Key received. GitHub answered.{" "}
            {prCount === 0
              ? "The board is clean — proposals will line up here."
              : `${prCount} proposal${prCount === 1 ? "" : "s"} waiting for your signature.`}{" "}
            SCAR·LET has the conn.
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
            className="min-w-0 flex-1 rounded-lg border-2 border-edge bg-void px-3 py-2 font-mono text-xs text-cyan placeholder:text-white/25 focus:border-cyan focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={connect}
            disabled={busy}
            data-accent="cyan"
            className="btn-pill btn-pill--solid px-4"
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
      <div className={`flex flex-col gap-1 rounded-lg border-2 bg-panel p-2.5 ${style}`}>
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
