import { promises as fs } from "fs";
import path from "path";
import { put, get, list } from "@vercel/blob";
import { verifyEvent } from "nostr-tools";
import { blobStoreEnabled } from "./registry";
import { isOperatorHex } from "./operator-auth";
import { currentBlockInfo } from "./bb/bft";

/**
 * Sign-offs — the cross-project approval tickets on the Action Items board.
 * Work raised in OTHER areas of the fleet (pacsarcade, knowledge-engine, the
 * shared-secrets rotation) surfaces here so the admiral signs everything from
 * ONE console. Each ticket carries a project tag, "what you're signing off"
 * in plain words, the change list, Number One's read, a comment box, and its
 * OWN gesture button (the sign string the key actually signs).
 *
 * The colour law is STRICT here: gold/coin = MONEY ONLY, so no sign-off ever
 * wears coin — ghost = danger, cyan = info/systems, pink = flair, neon = live.
 *
 * Same bones as decisions.ts: committed SEEDS (the board works with zero
 * infra), one record blob PER TICKET (concurrent sign-offs can't clobber),
 * dev keeps a single JSON file. The sign itself follows the briefs ladder:
 * shape → freshness → operator allowlist → schnorr signature — the signature
 * IS the verification, block-stamped at record time.
 */

/** Semantic accents a sign-off may wear — never "coin" (gold = money only). */
export type SignoffTone = "neon" | "cyan" | "pink" | "ghost";

export interface SignoffChange {
  kind: "add" | "del" | "note";
  text: string;
}

export type SignoffStatus = "open" | "signed";

export interface Signoff {
  id: string; // e.g. SEC-0001
  project: string; // the project tag (SECURITY · PAC'S ARCADE · KNOWLEDGE-ENGINE)
  area: string;
  title: string;
  /** one-line card summary */
  sum: string;
  raisedBy: string;
  tone: SignoffTone;
  /** high-priority / danger — SEC tickets; renders ghost with a DANGER pill */
  danger?: boolean;
  /** "what you're signing off" — plain-words paragraphs for the reader */
  detail: string[];
  changes: SignoffChange[];
  /** Number One's read */
  rec: string;
  /** the gesture button's label — what signing actually does */
  gesture: string;
  status: SignoffStatus;
  comment?: string;
  at?: number; // block height at sign time — BFT-stamped
  by?: string; // operator pubkey (hex)
  sig?: string;
}

/**
 * SEED_SIGNOFFS — the cross-project sign-offs currently awaiting the key
 * (pulled into SCAR·LET 2026-07-13). Committed on purpose, like the decision
 * seeds: the board is the record and stands up with no store behind it.
 */
export const SEED_SIGNOFFS: Signoff[] = [
  {
    id: "SEC-0001",
    project: "SECURITY (HIGH)",
    area: "cross-cutting · prod secrets",
    title: "⚠ Rotate shared production secrets per area",
    sum: "frens.earth was seeded with pacsarcade's PROD secrets as-is — two areas now SHARE keys. Rotate.",
    raisedBy: "number-one@frens",
    tone: "ghost",
    danger: true,
    detail: [
      "What you're signing off: during the 2026-07-10 frens.earth migration, frens-earth was seeded with pacsarcade-org's PRODUCTION secrets as-is — the same SEAT_SECRET, blob token and MATRIX_* — so two live areas now SHARE keys.",
      "The action isn't just a commit: rotate FRESH secrets per area (frens / pacsarcade / degen), set them per-project on Vercel, redeploy (a one-time sign-out — announce it first), then revoke the old keys.",
    ],
    changes: [
      { kind: "del", text: "Shared today: SEAT_SECRET, blob token, MATRIX_* — one set across two areas." },
      { kind: "add", text: "Rotate per area (frens / pacsarcade / degen) · set per-project on Vercel · redeploy · revoke old." },
      { kind: "note", text: "Sign-off also commits the ticket-raiser script that opened this." },
    ],
    rec: "HIGH — approve the rotation plan. Announce the one-time sign-out, rotate + set per-project, redeploy, then revoke the shared keys. Do not defer.",
    gesture: "Acknowledge & schedule rotation",
    status: "open",
  },
  {
    id: "CHG-0061",
    project: "PAC'S ARCADE",
    area: "pacBOT · public · SKILL.md",
    title: "pacBOT (public) · guardrail truth-fix",
    sum: "Guardrail #6 → verify from your own node first; mempool.space is fallback-only, marked unverified.",
    raisedBy: "number-one@frens",
    tone: "cyan",
    detail: [
      "What you're signing off: a one-line change to PacsArcade/pacBOT (public) · SKILL.md. Guardrail #6 now reads: “verify from your own node first; a public explorer like mempool.space is fallback-only, marked unverified.”",
      "It's public-facing, so the sign-off is a commit + push — your key records the approval and the push publishes it.",
    ],
    changes: [
      { kind: "add", text: "Guardrail #6 · SKILL.md — node-first; explorer fallback-only, marked unverified." },
      { kind: "note", text: "Repo PacsArcade/pacBOT (public) · 1 line." },
    ],
    rec: "Clean one-liner, matches the sovereign-truth rule. Sign off to commit & push it public.",
    gesture: "Sign off → commit & push",
    status: "open",
  },
  {
    id: "CHG-0062",
    project: "KNOWLEDGE-ENGINE",
    area: "skill guardrails · doc-only",
    title: "Skill guardrails · sovereign-truth",
    sum: "Two skill docs: node-first pacbot fix (vendored) + hallucination-guardrail ground-truth rule.",
    raisedBy: "number-one@frens",
    tone: "cyan",
    detail: [
      "What you're signing off: doc-only edits in pacsarcade/knowledge-engine. .claude/skills/pacbot/SKILL.md gets the same node-first fix (vendored), and .claude/skills/hallucination-guardrail/SKILL.md adds: “DB-1 is the node's own verified ground truth; ungroundable content is unverified → goes to the operator.”",
      "No code paths change — documentation only. The sign-off is a commit.",
    ],
    changes: [
      { kind: "add", text: "skills/pacbot/SKILL.md — node-first fix, vendored to match the public guardrail." },
      { kind: "add", text: "skills/hallucination-guardrail/SKILL.md — DB-1 = node's verified ground truth; ungroundable → operator." },
      { kind: "note", text: "Doc-only · repo pacsarcade/knowledge-engine." },
    ],
    rec: "Consistent with the pacBOT public fix and the sovereign-truth rule. Sign off to commit.",
    gesture: "Sign off → commit",
    status: "open",
  },
  {
    id: "CHG-0063",
    project: "KNOWLEDGE-ENGINE",
    area: "MUD boot · server.py",
    title: "MUD boot screen · VIOLET PHOSPHOR",
    sum: "CRT re-skin — violet palette + scanline underglow, reworked boot check, violet login shimmer. Visual only.",
    raisedBy: "glyph@frens",
    tone: "pink",
    detail: [
      "What you're signing off: a ~29-line visual re-skin in pacsarcade/knowledge-engine · services/mud/server.py (raised in another session). A CRT boot screen in a violet palette with scanline underglow, a reworked boot check ending “HIGH SCORE … UNDERSTANDING,” and a violet login shimmer.",
      "Visual only — no logic changes. The sign-off is a commit.",
    ],
    changes: [
      { kind: "add", text: "Violet CRT palette + scanline underglow on the boot screen." },
      { kind: "add", text: "Boot check reworked → ends “HIGH SCORE … UNDERSTANDING” · violet login shimmer." },
      { kind: "note", text: "Visual only, no logic · services/mud/server.py (~29 lines)." },
    ],
    rec: "On-brand flair, no logic touched. Sign off to commit.",
    gesture: "Sign off → commit",
    status: "open",
  },
];

interface SignRecord {
  id: string;
  comment?: string;
  at: number; // block height at sign time
  by: string; // operator pubkey (hex)
  sig: string;
}

/* Storage — one blob PER TICKET (the decisions/registry per-entry pattern):
   eventually-consistent Blob reads make a shared board doc clobber-prone, so
   every sign-off records into its own path. Dev keeps a single JSON file
   (single process → no clobber). */
const BLOB_DIR = "signoffs/records/";
const recordBlobPath = (id: string) => `${BLOB_DIR}${id}.json`;
function filePath(): string {
  return path.join(process.cwd(), "data", "signoffs.json");
}

async function readBlobText(pathname: string): Promise<string | null> {
  try {
    const res = await get(pathname, { access: "public" });
    if (!res || res.statusCode !== 200) return null;
    return await new Response(res.stream).text();
  } catch {
    return null;
  }
}

async function readRecords(): Promise<SignRecord[]> {
  if (blobStoreEnabled()) {
    const byId = new Map<string, SignRecord>();
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: BLOB_DIR, cursor });
      const texts = await Promise.all(page.blobs.map((b) => readBlobText(b.pathname)));
      for (const t of texts) {
        if (!t) continue;
        try {
          const r = JSON.parse(t) as SignRecord;
          if (r?.id) byId.set(r.id, r);
        } catch {
          /* skip a malformed record rather than break the board */
        }
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return [...byId.values()];
  }
  try {
    return (JSON.parse(await fs.readFile(filePath(), "utf8")) as { records: SignRecord[] })
      .records ?? [];
  } catch {
    return [];
  }
}

async function writeRecord(record: SignRecord): Promise<void> {
  if (blobStoreEnabled()) {
    await put(recordBlobPath(record.id), JSON.stringify(record), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }
  // dev only — single process, so a plain file read-modify-write is safe
  const p = filePath();
  let board: { records: SignRecord[] } = { records: [] };
  try {
    board = JSON.parse(await fs.readFile(p, "utf8")) as { records: SignRecord[] };
  } catch {
    /* first write — start empty */
  }
  const i = board.records.findIndex((r) => r.id === record.id);
  if (i >= 0) board.records[i] = record;
  else board.records.push(record);
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = p + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(board, null, 2), "utf8");
  await fs.rename(tmp, p);
}

/** The board: committed seeds with any signed record merged on top — open
    first (needs-you rides on top), signed newest-block first. */
export async function listSignoffs(): Promise<Signoff[]> {
  const signed = new Map((await readRecords()).map((r) => [r.id, r]));
  const merged = SEED_SIGNOFFS.map((s) => {
    const r = signed.get(s.id);
    if (!r) return { ...s };
    return {
      ...s,
      status: "signed" as const,
      comment: r.comment,
      at: r.at,
      by: r.by,
      sig: r.sig,
    };
  });
  return merged.sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    if (a.status === "open") return 0;
    return (b.at ?? 0) - (a.at ?? 0);
  });
}

/* The action string the operator key signs: `PACS-SIGNOFF-<id>-<ts>-sign`,
   optionally followed by `\n<comment>` — the signature covers the comment's
   exact words, same shape as the briefs review string. */
const SIGNOFF_ACTION_RE = /^PACS-SIGNOFF-([A-Z]{2,6}-\d{4})-(\d+)-sign(?:\n([\s\S]*))?$/;
const CHALLENGE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Verify a signed sign-off and record it. Same ladder as the briefs review:
 * shape → freshness → operator allowlist → signature. Block-stamped at record
 * time; the operator cookie gate lives in the API route.
 */
export async function recordSignoff(event: {
  content?: string;
  pubkey?: string;
  sig?: string;
  kind?: number;
  created_at?: number;
  tags?: unknown;
  id?: string;
}): Promise<{ ok: true; signoff: Signoff } | { ok: false; reason: string }> {
  if (!event?.content || !event.pubkey || !event.sig) {
    return { ok: false, reason: "signed sign-off required" };
  }
  const m = event.content.match(SIGNOFF_ACTION_RE);
  if (!m) return { ok: false, reason: "not a sign-off action" };
  const [, id, ts, rawComment] = m;
  if (Math.abs(Date.now() - Number(ts)) > CHALLENGE_WINDOW_MS) {
    return { ok: false, reason: "sign-off expired — sign a fresh one" };
  }
  if (!isOperatorHex(event.pubkey)) {
    return { ok: false, reason: "that key isn't on this site's operator list" };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!verifyEvent(event as any)) {
    return { ok: false, reason: "signature check failed" };
  }

  const seed = SEED_SIGNOFFS.find((s) => s.id === id);
  if (!seed) return { ok: false, reason: "no such sign-off on the board" };

  const comment = (rawComment ?? "").trim().slice(0, 4000) || undefined;
  const { height } = await currentBlockInfo();
  const record: SignRecord = { id, comment, at: height, by: event.pubkey, sig: event.sig };
  await writeRecord(record);
  return {
    ok: true,
    signoff: { ...seed, status: "signed", comment, at: height, by: event.pubkey, sig: event.sig },
  };
}
