import { promises as fs } from "fs";
import path from "path";
import { put, get } from "@vercel/blob";
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
}

export type DecisionStatus = "open" | "decided";

export interface Decision {
  id: string;
  question: string;
  context: string;
  options: DecisionOption[];
  recommendation: string; // optionKey Number One leans to
  recommendationWhy: string;
  status: DecisionStatus;
  choice?: string; // optionKey the admiral recorded
  note?: string; // the admiral's note at record time
  at?: number; // block height at record — BFT-stamped in the UI
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
      { key: "dark-earth", label: "Dark Earth", note: "the atmospheric hero" },
      { key: "registration-ceremony", label: "Registration Ceremony", note: "claim-your-tag as the act" },
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
    id: "onecocreation",
    question: "How do we handle onecocreation?",
    context: "The onecocreation brand — is there a real domain, or do we build one?",
    source: "onecocreation brand",
    options: [
      { key: "from-scratch", label: "From-scratch brand-kit build", note: "make the identity ourselves" },
      { key: "confirm-domain", label: "Confirm a real domain the admiral owns", note: "point at an existing property first" },
    ],
    recommendation: "from-scratch",
    recommendationWhy:
      "Flag first: the plural onecocreations.com doesn't resolve, and the singular is an unrelated business. No domain to inherit — a from-scratch brand kit is the honest path.",
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
  choice: string;
  note?: string;
  at: number; // block height at record time
}
interface Board {
  rulings: Ruling[];
}

const BLOB_PATH = "decisions/board.json";
function filePath(): string {
  return path.join(process.cwd(), "data", "decisions.json");
}

async function readBoard(): Promise<Board> {
  if (blobStoreEnabled()) {
    try {
      const res = await get(BLOB_PATH, { access: "public" });
      if (res && res.statusCode === 200) {
        return JSON.parse(await new Response(res.stream).text()) as Board;
      }
    } catch {
      /* missing/unreadable — start with the seeds, nothing recorded */
    }
    return { rulings: [] };
  }
  try {
    return JSON.parse(await fs.readFile(filePath(), "utf8")) as Board;
  } catch {
    return { rulings: [] };
  }
}

async function writeBoard(board: Board): Promise<void> {
  const body = JSON.stringify(board, null, 2);
  if (blobStoreEnabled()) {
    await put(BLOB_PATH, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }
  const p = filePath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = p + ".tmp";
  await fs.writeFile(tmp, body, "utf8");
  await fs.rename(tmp, p);
}

/** The full board: the committed seeds, with any recorded ruling merged on top.
    Open decisions come first, then the decided ones (most-recent block first). */
export async function listDecisions(): Promise<Decision[]> {
  const board = await readBoard();
  const ruled = new Map(board.rulings.map((r) => [r.id, r]));
  const merged = SEED_DECISIONS.map((d) => {
    const r = ruled.get(d.id);
    if (!r) return { ...d };
    return { ...d, status: "decided" as const, choice: r.choice, note: r.note, at: r.at };
  });
  return merged.sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    if (a.status === "decided") return (b.at ?? 0) - (a.at ?? 0);
    return 0;
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
  const board = await readBoard();
  const ruling: Ruling = { id, choice, note: trimmed, at: height };
  const i = board.rulings.findIndex((r) => r.id === id);
  if (i >= 0) board.rulings[i] = ruling;
  else board.rulings.push(ruling);
  await writeBoard(board);
  return {
    ok: true,
    decision: { ...seed, status: "decided", choice, note: trimmed, at: height },
  };
}
