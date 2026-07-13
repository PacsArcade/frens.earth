import { promises as fs } from "fs";
import path from "path";
import { put, get, list } from "@vercel/blob";
import { blobStoreEnabled } from "./registry";
import { currentBlockInfo } from "./bb/bft";

/**
 * Decisions — the admiral's action deck. The briefings were good data but not
 * actionable (Pac, 0018.04.16 a₿: "i want to be prompted with the actions, and
 * some recommendations, all from the web GUI"). So the pending rulings surface
 * here as CARDS: the question, the options, Number One's recommendation + why,
 * and a one-click record. The seeds are committed defaults (the ship's-log
 * pattern) so the board works with ZERO infra; a recorded choice is the only
 * thing that ever hits a store. Storage mirrors the registry's dual driver: a
 * single board doc in Vercel Blob (prod) or data/decisions.json (dev).
 *
 * Writes are operator-gated in the API route (the cookie opens the room); the
 * store itself just records — the same split as tickets/merges.
 */

export interface DecisionOption {
  key: string;
  label: string;
  note?: string;
  /** an asset to view before voting — opens in a new tab (the admiral can't
      vote on an asset they can't see). */
  link?: string;
}

export type DecisionStatus = "open" | "revise" | "decided";

export interface Decision {
  id: string;
  question: string;
  context: string;
  options: DecisionOption[];
  recommendation: string; // optionKey Number One leans to
  recommendationWhy: string;
  status: DecisionStatus;
  choice?: string; // optionKey the admiral recorded
  note?: string; // the admiral's note at record time (or what-to-change on a revise)
  at?: number; // block height at record — BFT-stamped in the UI
  revise?: boolean; // sent back for rework — a note with no choice
  source?: string; // where the ruling surfaced (topic / briefing)
}

/**
 * SEED_DECISIONS — the current pending rulings, each carrying Number One's
 * recommendation + why. Committed on purpose: the board is the record, and it
 * stands up with no store behind it. Add a ruling = one entry here.
 */
export const SEED_DECISIONS: Decision[] = [
  {
    id: "desk-name",
    question: "What do we name THE DESK?",
    context: "The copy-chief's station in the console still carries a working title.",
    source: "console naming",
    options: [
      { key: "the-desk", label: "The Desk", note: "plain, newsroom-literal" },
      { key: "the-slot", label: "The Slot", note: "the copy-chief's seat, arcade coin-slot wink" },
      { key: "the-galley", label: "The Galley", note: "the ship's kitchen — where copy gets cooked" },
    ],
    recommendation: "the-slot",
    recommendationWhy:
      "The Slot is the copy-chief's actual seat in a newsroom AND an arcade coin-slot wink — two of our wells in one word.",
    status: "open",
  },
  {
    id: "arrow-law",
    question: "How do the leading ▶ and breadcrumb ▸ glyphs get ruled?",
    context: "The house glyph standard needs one law so every surface reads the same.",
    source: "house glyph standard",
    options: [
      { key: "cut-both", label: "Cut both", note: "drop the leading ▶ and the breadcrumb ▸" },
      { key: "keep-leading", label: "Keep leading ▶ only", note: "keep ▶, retire the breadcrumb ▸" },
      { key: "keep-both", label: "Keep both", note: "no change" },
    ],
    recommendation: "keep-leading",
    recommendationWhy:
      "The leading ▶ reads as PLAY — it's semantic, keep it. Retire the breadcrumb ▸ for a middot (·) separator so paths stop wearing trailing arrows.",
    status: "open",
  },
  {
    id: "sat-mark",
    question: "Which mark do we strike for the satoshi?",
    context: "The sat needs its own glyph in the minor register, sibling to ₿.",
    source: "the money mark",
    options: [
      { key: "struck-ess", label: "Struck Ess", note: "an S with ₿'s double strike" },
      { key: "tally", label: "Tally", note: "a counting-mark feel" },
      { key: "bolt", label: "Bolt", note: "a lightning read" },
      { key: "single-strike", label: "Single Strike", note: "one bar through the S" },
    ],
    recommendation: "struck-ess",
    recommendationWhy:
      "The Struck Ess shares ₿'s hash-DNA and sits in the minor register like ¢ does to $ — the sat as bitcoin's cent.",
    status: "open",
  },
  {
    id: "readme-front-door",
    question: "What's the BFT README's front door?",
    context: "The BFT repo's README sets the first-read tone — manual or manifesto.",
    source: "docs · BFT front door",
    options: [
      { key: "field-manual", label: "Field Manual", note: "how it works, get running" },
      { key: "manifesto", label: "Manifesto", note: "why it matters, the argument" },
      { key: "invitation", label: "Invitation", note: "come build with us" },
      { key: "hatters-hour", label: "The Hatter's Hour", note: "Carroll-lore framing" },
    ],
    recommendation: "field-manual",
    recommendationWhy:
      "Field Manual as README.md (a newcomer wants to get running), with The Hatter's Hour as a MANIFESTO.md companion — both doors, right rooms.",
    status: "open",
  },
  {
    id: "historian-name",
    question: "What do we name the historian?",
    context: "The keeper of continuity — the memory-and-record role — needs a name.",
    source: "the historian",
    options: [
      { key: "quartermaster", label: "Quartermaster", note: "fleet-fit; keeps the stores and the ledger" },
      { key: "attract-mode", label: "Attract Mode", note: "the arcade's between-plays reel" },
      { key: "continue", label: "Continue", note: "the coin-drop second chance" },
    ],
    recommendation: "quartermaster",
    recommendationWhy:
      "No strong lean — all three are live. If forced, Quartermaster is the fleet-fit: it already means the one who keeps the stores and the ledger.",
    status: "open",
  },
  {
    id: "flagship-format",
    question: "What format does the flagship page take?",
    context: "The landing needs a shape — hero, ceremony, or both.",
    source: "the flagship page",
    options: [
      {
        key: "dark-earth",
        label: "Dark Earth",
        note: "the atmospheric hero",
        link: "https://claude.ai/code/artifact/4bf037db-6c64-4d88-b8a8-6cae98b9427b",
      },
      {
        key: "registration-ceremony",
        label: "Registration Ceremony",
        note: "claim-your-tag as the act",
        link: "https://claude.ai/code/artifact/b3113041-fa0a-4c61-b571-6de0222ba586",
      },
      { key: "hybrid", label: "Hybrid", note: "hero on top, ceremony below" },
    ],
    recommendation: "hybrid",
    recommendationWhy:
      "Hybrid: the Dark Earth hero pulls them in, the Registration Ceremony below turns the visit into a claim — mood then action, one scroll.",
    status: "open",
  },
  {
    id: "ranks-access",
    question: "How do we settle ranks & access levels?",
    context: "The role tiers and what each can reach — a design worth its own table.",
    source: "roles & access",
    options: [
      { key: "session", label: "Schedule a dedicated session", note: "map it whole, on purpose" },
      { key: "decide-now", label: "Decide now", note: "sketch the tiers in this pass" },
    ],
    recommendation: "session",
    recommendationWhy:
      "A dedicated session — per the admiral's own note. Ranks touch every gate; map them whole rather than sketch them between other work.",
    status: "open",
  },
  {
    id: "money-label-gold",
    question: "Does the media-page MONEY label keep its gold?",
    context: "The color contract locks gold to money. The media page labels money in gold.",
    source: "media page · color contract",
    options: [
      { key: "keep", label: "Keep gold on money labels", note: "the contract, demonstrated" },
      { key: "neutralize", label: "Neutralize to white", note: "quieter, less semantic" },
    ],
    recommendation: "keep",
    recommendationWhy:
      "Keep it — this is the semantic color contract demonstrating itself on an actual money concept. Gold on money is the rule working, not breaking it.",
    status: "open",
  },
  {
    id: "beat-index",
    question: "What's the canonical form of the beat index?",
    context: "The 144-block day's beat is counted two ways — pick the canon.",
    source: "BFT beat index",
    options: [
      { key: "dual", label: "0–143 under the hood + 1–144 on the face", note: "machine 0-indexed, human 1-based" },
      { key: "all-zero", label: "All 0-indexed", note: "0–143 everywhere" },
      { key: "all-one", label: "All 1-indexed", note: "1–144 everywhere" },
    ],
    recommendation: "dual",
    recommendationWhy:
      "Dual: the machine counts 0–143, the face reads 1–144 — exactly like the year (the code starts at 0, the day-of-month reads 1). Honest in both registers.",
    status: "open",
  },
];

interface Ruling {
  id: string;
  choice?: string; // absent on a revise (a note with no pick)
  note?: string;
  revise?: boolean; // sent back for rework — carries a note + at, no choice
  at: number; // block height at record time
}
interface Board {
  rulings: Ruling[];
}

/* Storage — ONE BLOB PER RULING, never a shared board doc. A single document
   read-modify-written on every record clobbers earlier rulings: Blob reads are
   eventually consistent, so recording a second choice can read a STALE board
   that's missing the first and overwrite it (Pac's catch, 0018.04.16 a₿:
   "i approved arrows, it didn't save, but the other one stuck"). Per-ruling
   blobs never overwrite each other — the same per-entry fix the ship's log and
   the registry (per-handle blobs) already use. Dev keeps one JSON file (single
   process → no clobber). The legacy board.json is still read for back-compat so
   nothing already recorded is lost. */
const BLOB_DIR = "decisions/rulings/";
const LEGACY_BLOB_PATH = "decisions/board.json";
const rulingBlobPath = (id: string) => `${BLOB_DIR}${id}.json`;
function filePath(): string {
  return path.join(process.cwd(), "data", "decisions.json");
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

async function readRulings(): Promise<Ruling[]> {
  if (blobStoreEnabled()) {
    const byId = new Map<string, Ruling>();
    // legacy shared board first (back-compat); authoritative per-ruling blobs win
    const legacy = await readBlobText(LEGACY_BLOB_PATH);
    if (legacy) {
      try {
        for (const r of (JSON.parse(legacy) as Board).rulings ?? []) byId.set(r.id, r);
      } catch {
        /* ignore a malformed legacy doc */
      }
    }
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: BLOB_DIR, cursor });
      const texts = await Promise.all(page.blobs.map((b) => readBlobText(b.pathname)));
      for (const t of texts) {
        if (!t) continue;
        try {
          const r = JSON.parse(t) as Ruling;
          if (r?.id) byId.set(r.id, r);
        } catch {
          /* skip a malformed ruling rather than break the board */
        }
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return [...byId.values()];
  }
  try {
    return (JSON.parse(await fs.readFile(filePath(), "utf8")) as Board).rulings ?? [];
  } catch {
    return [];
  }
}

async function writeRuling(ruling: Ruling): Promise<void> {
  if (blobStoreEnabled()) {
    await put(rulingBlobPath(ruling.id), JSON.stringify(ruling), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }
  // dev only — single process, so a plain file read-modify-write is safe
  const p = filePath();
  let board: Board = { rulings: [] };
  try {
    board = JSON.parse(await fs.readFile(p, "utf8")) as Board;
  } catch {
    /* first write — start empty */
  }
  const i = board.rulings.findIndex((r) => r.id === ruling.id);
  if (i >= 0) board.rulings[i] = ruling;
  else board.rulings.push(ruling);
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = p + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(board, null, 2), "utf8");
  await fs.rename(tmp, p);
}

/** The full board: the committed seeds, with any recorded ruling merged on top.
    A ruling with a note but NO choice is a REVISE (sent back for rework); one
    with a choice is DECIDED. Order: open first, then revise (awaiting rework),
    then decided — each of the latter two most-recent block first. */
export async function listDecisions(): Promise<Decision[]> {
  const ruled = new Map((await readRulings()).map((r) => [r.id, r]));
  const merged = SEED_DECISIONS.map((d) => {
    const r = ruled.get(d.id);
    if (!r) return { ...d };
    if (r.revise && !r.choice) {
      return { ...d, status: "revise" as const, revise: true, note: r.note, at: r.at };
    }
    return { ...d, status: "decided" as const, choice: r.choice, note: r.note, at: r.at };
  });
  const rank = { open: 0, revise: 1, decided: 2 } as const;
  return merged.sort((a, b) => {
    if (a.status !== b.status) return rank[a.status] - rank[b.status];
    if (a.status === "open") return 0;
    return (b.at ?? 0) - (a.at ?? 0); // revise + decided: newest block first
  });
}

/**
 * Record the admiral's choice: sets status decided + choice + a BFT stamp (the
 * block height at record time — the block IS the record). Validated against the
 * decision's own options; the operator gate lives in the API route.
 */
export async function recordDecision(
  id: string,
  choice: string,
  note?: string,
): Promise<{ ok: true; decision: Decision } | { ok: false; reason: string }> {
  const seed = SEED_DECISIONS.find((d) => d.id === id);
  if (!seed) return { ok: false, reason: "no such decision on the board" };
  if (!seed.options.some((o) => o.key === choice)) {
    return { ok: false, reason: "that isn't one of the options" };
  }
  const trimmed = (note ?? "").trim().slice(0, 2000) || undefined;
  const { height } = await currentBlockInfo();
  const ruling: Ruling = { id, choice, note: trimmed, at: height };
  await writeRuling(ruling);
  return {
    ok: true,
    decision: { ...seed, status: "decided", choice, note: trimmed, at: height },
  };
}

/**
 * Send a decision back for another pass: a note with NO choice — "none of
 * these, here's what to change." Writes a revise ruling ({ revise: true, note,
 * at }, no choice) via the SAME per-ruling store, so it supersedes any prior
 * ruling and the decision comes back around for a fresh decision. The note is
 * required (it's the whole point — it tells Number One what to rework). The
 * operator gate lives in the API route.
 */
export async function recordRevise(
  id: string,
  note: string,
): Promise<{ ok: true; decision: Decision } | { ok: false; reason: string }> {
  const seed = SEED_DECISIONS.find((d) => d.id === id);
  if (!seed) return { ok: false, reason: "no such decision on the board" };
  const trimmed = (note ?? "").trim().slice(0, 2000);
  if (!trimmed) return { ok: false, reason: "a send-back needs a note — say what to change" };
  const { height } = await currentBlockInfo();
  const ruling: Ruling = { id, revise: true, note: trimmed, at: height };
  await writeRuling(ruling);
  return {
    ok: true,
    decision: { ...seed, status: "revise", revise: true, note: trimmed, at: height },
  };
}
