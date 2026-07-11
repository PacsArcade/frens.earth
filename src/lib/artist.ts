import { promises as fs } from "fs";
import path from "path";
import { put, get } from "@vercel/blob";
import { nip19 } from "nostr-tools";
import { blobStoreEnabled, getEntry } from "./registry";
import { frenFromRequest } from "./fren-auth";
import { spacesConfigured, spacesRpc, SpacesNodeError } from "./spaces";

/**
 * The Artist Registry — the Pac's Arcade brand-kit module for artists
 * (docs/artist-registry.md). Three stores + the spaced auction lens:
 *
 *   - ROSTER   — the artist-training entitlement, v1: an operator-editable
 *                npub allowlist (GUI-first like nodeconfig; ARTIST_NPUBS env
 *                stays as the bootstrap fallback).
 *   - REQUESTS — an artist asks for their name on the Spaces protocol. The
 *                request is a QUEUE ENTRY, not an on-chain action: the crew
 *                opens/bids the auction from the node's own wallet — keys
 *                never touch this app (house law).
 *   - WATCHES  — names an artist keeps an eye on, persisted per-npub.
 *
 * Storage mirrors tickets/merges: dual driver — Vercel Blob in prod, JSON
 * files in data/ for dev (gitignored, never tracked). Auction reads go to
 * this deployment's spaced node via spaces.ts and DEGRADE HONESTLY: every
 * query returns "not configured" / "unreachable" instead of pretending.
 */

/* ── the entitlement roster ─────────────────────────────────────────────── */

export interface ArtistRoster {
  npubs: string[];
  updatedAt: string | null;
}

const ROSTER_BLOB = "artist/roster.json";
const rosterFile = () => path.join(process.cwd(), "data", "artists.json");

async function readJson<T>(blobPath: string, file: string): Promise<T | null> {
  if (blobStoreEnabled()) {
    try {
      const res = await get(blobPath, { access: "public" });
      if (res && res.statusCode === 200) {
        return JSON.parse(await new Response(res.stream).text()) as T;
      }
    } catch {
      /* missing/unreadable — treat as empty */
    }
    return null;
  }
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function writeJson(blobPath: string, file: string, value: unknown): Promise<void> {
  const body = JSON.stringify(value, null, 2);
  if (blobStoreEnabled()) {
    await put(blobPath, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  await fs.writeFile(tmp, body, "utf8");
  await fs.rename(tmp, file);
}

function decodeNpub(raw: string): string | null {
  try {
    const d = nip19.decode(raw.trim().toLowerCase());
    return d.type === "npub" ? (d.data as string) : null;
  } catch {
    return null;
  }
}

function envArtistNpubs(): string[] {
  return (process.env.ARTIST_NPUBS ?? "")
    .split(",")
    .map((n) => n.trim().toLowerCase())
    .filter((n) => !!decodeNpub(n));
}

/** The stored roster (operator-edited from the console). */
export async function readArtistRoster(): Promise<ArtistRoster> {
  const stored = await readJson<ArtistRoster>(ROSTER_BLOB, rosterFile());
  return { npubs: stored?.npubs ?? [], updatedAt: stored?.updatedAt ?? null };
}

/** Replace the roster. Rejects anything that isn't a real npub — the gate
    must never hold junk that silently matches nobody. */
export async function writeArtistRoster(
  npubs: string[]
): Promise<{ ok: true; roster: ArtistRoster } | { ok: false; reason: string }> {
  const cleaned: string[] = [];
  for (const raw of npubs) {
    const n = raw.trim().toLowerCase();
    if (!n) continue;
    if (!decodeNpub(n)) return { ok: false, reason: `not a public key (npub1…): ${n.slice(0, 20)}…` };
    if (!cleaned.includes(n)) cleaned.push(n);
  }
  const roster: ArtistRoster = { npubs: cleaned, updatedAt: new Date().toISOString() };
  await writeJson(ROSTER_BLOB, rosterFile(), roster);
  return { ok: true, roster };
}

/** Effective allowlist: stored roster when set, ARTIST_NPUBS bootstrap
    otherwise (the nodeconfig pattern — GUI wins, env keeps a fresh fork
    working from .env alone). Compared as hex so encoding quirks never
    lock an artist out. */
export async function isArtistNpub(npub: string): Promise<boolean> {
  const hex = decodeNpub(npub);
  if (!hex) return false;
  const stored = await readArtistRoster();
  const list = stored.npubs.length ? stored.npubs : envArtistNpubs();
  return list.some((n) => decodeNpub(n) === hex);
}

/* ── the request gate — one check for every /api/artist route ───────────── */

export type ArtistGate =
  | { ok: true; handle: string; space: string; npub: string }
  | { ok: false; status: number; reason: string; signedIn: boolean };

/** Session → tag → npub → roster. 401 = no session; 403 = signed in but the
    training package hasn't opened this door (the honest LEVEL LOCKED). */
export async function artistFromRequest(request: Request): Promise<ArtistGate> {
  const fren = frenFromRequest(request);
  if (!fren) {
    return { ok: false, status: 401, reason: "sign in with your tag first, fren", signedIn: false };
  }
  const entry = await getEntry(fren.handle, fren.space);
  if (!entry?.npub || !(await isArtistNpub(entry.npub))) {
    return {
      ok: false,
      status: 403,
      reason: "LEVEL LOCKED — the artist training package opens this door",
      signedIn: true,
    };
  }
  return { ok: true, handle: fren.handle, space: fren.space, npub: entry.npub };
}

/* ── name requests — request → auction → won/lost → anchored ────────────── */

export type ArtistRequestStatus = "requested" | "auction" | "won" | "lost" | "anchored";

export const REQUEST_STATUSES: ArtistRequestStatus[] = [
  "requested",
  "auction",
  "won",
  "lost",
  "anchored",
];

export interface ArtistNameRequest {
  id: string; // e.g. SPC-0004
  name: string; // bare space name, e.g. "pak" (on-chain form = @pak)
  npub: string;
  requestedBy: string; // "pak@frens" — the tag that asked
  note: string;
  status: ArtistRequestStatus;
  createdAt: string;
  updatedAt: string;
  /** bitcoin tip when the request entered the queue — bitcoin time, not
      calendar time (null when the tip couldn't be read). */
  blockHeight: number | null;
  /** the on-chain open/bid txid once the crew starts the auction (round 2). */
  txid: string | null;
}

interface RequestBoard {
  seq: number;
  requests: ArtistNameRequest[];
}

const REQUESTS_BLOB = "artist/requests.json";
const requestsFile = () => path.join(process.cwd(), "data", "artist-requests.json");

async function readRequestBoard(): Promise<RequestBoard> {
  return (await readJson<RequestBoard>(REQUESTS_BLOB, requestsFile())) ?? { seq: 0, requests: [] };
}

/** Spaces protocol names: lowercase a-z / 0-9 / hyphens, no @ (we add it at
    the node boundary). Kept close to the protocol's ASCII rules. */
const SPACE_NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function validateSpaceName(raw: string): { ok: true; name: string } | { ok: false; reason: string } {
  const name = raw.trim().toLowerCase().replace(/^@/, "");
  if (name.length < 1 || name.length > 63) return { ok: false, reason: "1–63 characters" };
  if (!SPACE_NAME_RE.test(name)) {
    return { ok: false, reason: "a-z, 0-9 and hyphens only (no leading/trailing hyphen)" };
  }
  return { ok: true, name };
}

/** Newest first; scoped to one npub for the artist's own view. */
export async function listNameRequests(opts?: { npub?: string }): Promise<ArtistNameRequest[]> {
  const board = await readRequestBoard();
  const all = [...board.requests].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return opts?.npub ? all.filter((r) => r.npub === opts.npub) : all;
}

export async function requestName(input: {
  name: string;
  npub: string;
  requestedBy: string;
  note?: string;
  blockHeight?: number | null;
}): Promise<{ ok: true; request: ArtistNameRequest } | { ok: false; reason: string }> {
  const v = validateSpaceName(input.name);
  if (!v.ok) return { ok: false, reason: v.reason };
  const board = await readRequestBoard();
  const dupe = board.requests.find(
    (r) => r.name === v.name && r.npub === input.npub && r.status !== "lost"
  );
  if (dupe) return { ok: false, reason: `@${v.name} is already on your request board (${dupe.id})` };
  const seq = board.seq + 1;
  const now = new Date().toISOString();
  const request: ArtistNameRequest = {
    id: `SPC-${String(seq).padStart(4, "0")}`,
    name: v.name,
    npub: input.npub,
    requestedBy: input.requestedBy,
    note: (input.note ?? "").trim().slice(0, 500),
    status: "requested",
    createdAt: now,
    updatedAt: now,
    blockHeight: input.blockHeight ?? null,
    txid: null,
  };
  board.seq = seq;
  board.requests.push(request);
  await writeJson(REQUESTS_BLOB, requestsFile(), board);
  return { ok: true, request };
}

/** The lifecycle flip — operator-side (console GUI lands in round 2; the
    sanctioned mutation ships now so statuses never get hand-edited). */
export async function updateRequestStatus(
  id: string,
  status: ArtistRequestStatus,
  txid?: string
): Promise<ArtistNameRequest | null> {
  if (!REQUEST_STATUSES.includes(status)) return null;
  const board = await readRequestBoard();
  const r = board.requests.find((x) => x.id === id);
  if (!r) return null;
  r.status = status;
  if (txid) r.txid = txid.trim();
  r.updatedAt = new Date().toISOString();
  await writeJson(REQUESTS_BLOB, requestsFile(), board);
  return r;
}

/* ── watches — WATCH YOUR NAME, per-npub ────────────────────────────────── */

export interface ArtistWatch {
  npub: string;
  name: string; // bare space name
  addedAt: string;
  /** bitcoin tip when the watch was set — for the BFT stamp. */
  blockHeight: number | null;
}

interface WatchBoard {
  watches: ArtistWatch[];
}

const WATCHES_BLOB = "artist/watches.json";
const watchesFile = () => path.join(process.cwd(), "data", "artist-watches.json");

async function readWatchBoard(): Promise<WatchBoard> {
  return (await readJson<WatchBoard>(WATCHES_BLOB, watchesFile())) ?? { watches: [] };
}

export async function listWatches(npub: string): Promise<ArtistWatch[]> {
  const board = await readWatchBoard();
  return board.watches
    .filter((w) => w.npub === npub)
    .sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
}

export async function addWatch(input: {
  npub: string;
  name: string;
  blockHeight?: number | null;
}): Promise<{ ok: true; watch: ArtistWatch } | { ok: false; reason: string }> {
  const v = validateSpaceName(input.name);
  if (!v.ok) return { ok: false, reason: v.reason };
  const board = await readWatchBoard();
  const existing = board.watches.find((w) => w.npub === input.npub && w.name === v.name);
  if (existing) return { ok: true, watch: existing }; // watching twice is just watching
  const watch: ArtistWatch = {
    npub: input.npub,
    name: v.name,
    addedAt: new Date().toISOString(),
    blockHeight: input.blockHeight ?? null,
  };
  board.watches.push(watch);
  await writeJson(WATCHES_BLOB, watchesFile(), board);
  return { ok: true, watch };
}

export async function removeWatch(npub: string, name: string): Promise<boolean> {
  const v = validateSpaceName(name);
  if (!v.ok) return false;
  const board = await readWatchBoard();
  const before = board.watches.length;
  board.watches = board.watches.filter((w) => !(w.npub === npub && w.name === v.name));
  if (board.watches.length === before) return false;
  await writeJson(WATCHES_BLOB, watchesFile(), board);
  return true;
}

/* ── the auction lens — spaced queries that never pretend ───────────────── */

/** One rollout/auction row. `spaced` shapes are loose until confirmed against
    a running node (the spaces.ts precedent) — we normalize defensively. */
export interface AuctionEntry {
  name: string; // bare, no @
  /** current/estimated bid in sats — money, renders gold. Null when the node
      didn't say. */
  bid: number | null;
  raw?: unknown;
}

export type AuctionBoard =
  | { configured: false }
  | { configured: true; reachable: false; reason: string }
  | {
      configured: true;
      reachable: true;
      chain: string | null;
      tip: { height?: number; hash?: string } | null;
      auctions: AuctionEntry[];
    };

function normalizeRollout(rows: unknown): AuctionEntry[] {
  if (!Array.isArray(rows)) return [];
  const out: AuctionEntry[] = [];
  for (const row of rows) {
    // seen in the wild as ["@name", value] tuples and { name/space, value/bid } objects
    if (Array.isArray(row) && typeof row[0] === "string") {
      out.push({
        name: row[0].replace(/^@/, ""),
        bid: typeof row[1] === "number" ? row[1] : null,
        raw: row,
      });
      continue;
    }
    if (row && typeof row === "object") {
      const o = row as Record<string, unknown>;
      const rawName = o.name ?? o.space;
      if (typeof rawName === "string") {
        const value = o.value ?? o.bid;
        out.push({
          name: rawName.replace(/^@/, ""),
          bid: typeof value === "number" ? value : null,
          raw: row,
        });
      }
    }
  }
  return out;
}

/** The open/rolling auctions from this deployment's node. Honest tri-state:
    no node configured, node down, or the real board. */
export async function auctionBoard(): Promise<AuctionBoard> {
  if (!(await spacesConfigured())) return { configured: false };
  try {
    const info = await spacesRpc<{ chain?: string; tip?: { height?: number; hash?: string } }>(
      "getserverinfo"
    );
    let auctions: AuctionEntry[] = [];
    try {
      // target interval 0 = the next rollout window (the "opening soon" board)
      auctions = normalizeRollout(await spacesRpc("getrollout", [0]));
    } catch {
      auctions = []; // node up but no rollout answer — show the board empty, honestly
    }
    return {
      configured: true,
      reachable: true,
      chain: info.chain ?? null,
      tip: info.tip ?? null,
      auctions,
    };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      reason: err instanceof SpacesNodeError ? err.message : "node error",
    };
  }
}

/** Best-effort read of one name's on-chain life. */
export type SpaceNameStatus =
  | { configured: false }
  | { configured: true; reachable: false; reason: string }
  | {
      configured: true;
      reachable: true;
      name: string;
      /** available = no covenant on chain · rollout/auction = in play ·
          registered = someone holds it · unknown = the node answered in a
          shape we don't classify yet (raw rides along). */
      status: "available" | "rollout" | "auction" | "registered" | "unknown";
      detail: string;
      raw: unknown;
    };

function classifySpace(name: string, raw: unknown): { status: "available" | "rollout" | "auction" | "registered" | "unknown"; detail: string } {
  if (raw == null) return { status: "available", detail: `@${name} has no on-chain record — open to a bid` };
  if (typeof raw === "object") {
    const covenant = (raw as Record<string, unknown>).covenant as Record<string, unknown> | undefined;
    const type = typeof covenant?.type === "string" ? covenant.type : null;
    if (type === "bid") {
      const claim = covenant?.claim_height;
      if (claim == null) return { status: "rollout", detail: "carrying a bid — waiting for its auction window" };
      return { status: "auction", detail: `in auction — claimable at block ${claim}` };
    }
    if (type === "transfer" || type === "reserved") {
      return { status: "registered", detail: "registered — someone holds this name" };
    }
  }
  return { status: "unknown", detail: "the node answered in a shape we don't classify yet" };
}

export async function spaceNameStatus(rawName: string): Promise<SpaceNameStatus | { error: string }> {
  const v = validateSpaceName(rawName);
  if (!v.ok) return { error: v.reason };
  if (!(await spacesConfigured())) return { configured: false };
  try {
    const raw = await spacesRpc<unknown>("getspace", [`@${v.name}`]);
    const { status, detail } = classifySpace(v.name, raw);
    return { configured: true, reachable: true, name: v.name, status, detail, raw };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      reason: err instanceof SpacesNodeError ? err.message : "node error",
    };
  }
}
