import { promises as fs } from "fs";
import path from "path";
import { head, list, put, get, del, BlobNotFoundError } from "@vercel/blob";
import { KNOWN_SPACES, SPACE_NAME } from "./identity-config";

/**
 * Handle registry — queue of tag claims, one entry per handle per space.
 *
 * Storage drivers:
 * - Vercel Blob (production): one immutable blob per claim at
 *   registry/<space>/<handle>.json. `allowOverwrite: false` makes the claim
 *   create-if-not-exists, so the pathname itself enforces handle uniqueness
 *   even under concurrent claims. Blobs are never rewritten pre-ceremony, so
 *   CDN caching can never serve a stale registry state.
 * - Files (local dev): data/<space>-registry.json, zero infrastructure; the
 *   predev reset script keeps every dev revision's queue empty.
 *
 * The blob driver is only used on Vercel (or with REGISTRY_DRIVER=blob) so a
 * local `npm run dev` with a pulled .env.local can never write test claims
 * into the production store. Every caller goes through this interface, so
 * swapping storage touches nothing else.
 */

export type HandleStatus = "queued" | "committed";

export interface HandleEntry {
  handle: string; // bare name, e.g. "alice" (full tag = alice@<space>)
  npub: string; // nostr public key, bech32
  status: HandleStatus;
  batchId: string | null; // on-chain batch that committed it (R2)
  requestedAt: string; // ISO timestamp
  blockHeight?: number | null; // bitcoin tip when the claim entered the queue — bitcoin time, not calendar time (absent on pre-R2 entries; profile backfills via mempool.space)
  matrix?: boolean; // matrix door cut for this tag (@handle:pacsarcade.org)
}

export function blobStoreEnabled(): boolean {
  return (
    !!process.env.BLOB_READ_WRITE_TOKEN &&
    (process.env.VERCEL === "1" || process.env.REGISTRY_DRIVER === "blob")
  );
}

function normalizeSpace(space?: string): string {
  const s = (space ?? SPACE_NAME).toLowerCase();
  return (KNOWN_SPACES as readonly string[]).includes(s) ? s : SPACE_NAME;
}

/** Names never claimable through the public queue. */
const RESERVED = new Set([
  "pac",
  "pacman",
  "adminpacman",
  "dminpacman",
  "adminpac",
  "dminpac",
  "pacsarcade",
  "admin",
  "root",
  "mod",
  "moderator",
  "support",
  "help",
  "official",
  "frens",
  "wallet",
  "bitcoin",
  "satoshi",
]);

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{1,18})[a-z0-9]$/;

export function validateHandle(raw: string): { ok: true; handle: string } | { ok: false; reason: string } {
  const handle = raw.trim().toLowerCase();
  if (handle.length < 3 || handle.length > 20) {
    return { ok: false, reason: "3-20 characters" };
  }
  if (!HANDLE_RE.test(handle)) {
    return { ok: false, reason: "a-z, 0-9 and hyphens only (no leading/trailing hyphen)" };
  }
  if (RESERVED.has(handle)) {
    return { ok: false, reason: "reserved name" };
  }
  return { ok: true, handle };
}

// ---------------------------------------------------------------------------
// File driver (local dev)
// ---------------------------------------------------------------------------

interface RegistryFile {
  space: string;
  entries: HandleEntry[];
}

function registryPath(space: string): string {
  return path.join(process.cwd(), "data", `${space}-registry.json`);
}

async function fileRead(space: string): Promise<RegistryFile> {
  try {
    const raw = await fs.readFile(registryPath(space), "utf8");
    return JSON.parse(raw) as RegistryFile;
  } catch {
    return { space, entries: [] };
  }
}

async function fileWrite(space: string, reg: RegistryFile): Promise<void> {
  const p = registryPath(space);
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = p + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(reg, null, 2), "utf8");
  await fs.rename(tmp, p);
}

// ---------------------------------------------------------------------------
// Vercel Blob driver (production)
// ---------------------------------------------------------------------------

function blobPath(space: string, handle: string): string {
  return `registry/${space}/${handle}.json`;
}

function blobPrefix(space: string): string {
  return `registry/${space}/`;
}

async function blobExists(space: string, handle: string): Promise<boolean> {
  try {
    await head(blobPath(space, handle));
    return true;
  } catch (err) {
    if (err instanceof BlobNotFoundError) return false;
    throw err;
  }
}

/** Total claims in a space (metadata only — no content fetches). */
async function blobCount(space: string): Promise<number> {
  let count = 0;
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: blobPrefix(space), cursor });
    count += page.blobs.length;
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return count;
}

async function blobEntries(space: string): Promise<HandleEntry[]> {
  const entries: HandleEntry[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: blobPrefix(space), cursor });
    const contents = await Promise.all(
      page.blobs.map(async (b) => {
        try {
          const res = await get(b.pathname, { access: "public" });
          if (!res || res.statusCode !== 200) return null;
          return JSON.parse(await new Response(res.stream).text()) as HandleEntry;
        } catch {
          return null; // skip malformed entries rather than break everyone
        }
      })
    );
    for (const e of contents) if (e) entries.push(e);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return entries;
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export async function isAvailable(handle: string, space?: string): Promise<boolean> {
  const s = normalizeSpace(space);
  if (blobStoreEnabled()) {
    return !(await blobExists(s, handle));
  }
  const reg = await fileRead(s);
  return !reg.entries.some((e) => e.handle === handle);
}

/** A single claim, or null if the handle is unclaimed. */
export async function getEntry(handle: string, space?: string): Promise<HandleEntry | null> {
  const s = normalizeSpace(space);
  if (blobStoreEnabled()) {
    try {
      const res = await get(blobPath(s, handle), { access: "public" });
      if (!res || res.statusCode !== 200) return null;
      return JSON.parse(await new Response(res.stream).text()) as HandleEntry;
    } catch {
      return null;
    }
  }
  const reg = await fileRead(s);
  return reg.entries.find((e) => e.handle === handle) ?? null;
}

export async function claimHandle(
  handle: string,
  npub: string,
  space?: string,
  blockHeight?: number | null
): Promise<{ ok: true; entry: HandleEntry; queuePosition: number } | { ok: false; reason: string }> {
  const valid = validateHandle(handle);
  if (!valid.ok) return { ok: false, reason: valid.reason };

  if (!/^npub1[02-9ac-hj-np-z]{58}$/.test(npub)) {
    return { ok: false, reason: "invalid nostr public key" };
  }

  const s = normalizeSpace(space);
  const entry: HandleEntry = {
    handle: valid.handle,
    npub,
    status: "queued",
    batchId: null,
    requestedAt: new Date().toISOString(),
    blockHeight: blockHeight ?? null,
  };

  if (blobStoreEnabled()) {
    try {
      await put(blobPath(s, valid.handle), JSON.stringify(entry, null, 2), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: false, // create-if-not-exists: the atomic uniqueness check
        contentType: "application/json",
      });
    } catch {
      if (await blobExists(s, valid.handle)) {
        return { ok: false, reason: "already claimed" };
      }
      return { ok: false, reason: "the claim queue hiccuped — try again in a moment" };
    }
    return { ok: true, entry, queuePosition: await blobCount(s) };
  }

  const reg = await fileRead(s);
  if (reg.entries.some((e) => e.handle === valid.handle)) {
    return { ok: false, reason: "already claimed" };
  }
  reg.entries.push(entry);
  try {
    await fileWrite(s, reg);
  } catch {
    return { ok: false, reason: "the claim queue isn't open on this deployment yet — check back soon" };
  }
  return { ok: true, entry, queuePosition: reg.entries.filter((e) => e.status === "queued").length };
}

/** Post-claim update (matrix door cut, etc.) — the one sanctioned rewrite
    of a claim record. Pathname (and so uniqueness) never changes. */
export async function updateEntry(
  handle: string,
  space: string | undefined,
  patch: Partial<Pick<HandleEntry, "matrix">>
): Promise<boolean> {
  const s = normalizeSpace(space);
  const existing = await getEntry(handle, s);
  if (!existing) return false;
  const next: HandleEntry = { ...existing, ...patch };
  if (blobStoreEnabled()) {
    try {
      await put(blobPath(s, handle), JSON.stringify(next, null, 2), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      return true;
    } catch {
      return false;
    }
  }
  const reg = await fileRead(s);
  const i = reg.entries.findIndex((e) => e.handle === handle);
  if (i < 0) return false;
  reg.entries[i] = next;
  try {
    await fileWrite(s, reg);
    return true;
  } catch {
    return false;
  }
}

/** Release a PENDING name back to the pool — the fren's right of exit while
    the anchor hasn't etched. Etched entries are permanent by design. */
export async function releaseHandle(
  handle: string,
  space?: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const s = normalizeSpace(space);
  const entry = await getEntry(handle, s);
  if (!entry) return { ok: false, reason: "that tag isn't on the board" };
  if (entry.status !== "queued") {
    return { ok: false, reason: "already etched to Bitcoin — permanent is permanent" };
  }
  if (blobStoreEnabled()) {
    try {
      await del(blobPath(s, handle));
    } catch {
      return { ok: false, reason: "the registry hiccuped — try again in a moment" };
    }
  } else {
    const reg = await fileRead(s);
    reg.entries = reg.entries.filter((e) => e.handle !== handle);
    try {
      await fileWrite(s, reg);
    } catch {
      return { ok: false, reason: "the registry hiccuped — try again in a moment" };
    }
  }
  npubCache.delete(entry.npub);
  return { ok: true };
}

/* Reverse lookup for sign-in: which tag does this npub own? Scans every
   space; cached briefly — the registry is small and sign-ins are rare. */
const npubCache = new Map<string, { at: number; value: { handle: string; space: string } | null }>();
const NPUB_CACHE_TTL_MS = 60_000;

export async function findHandleByNpub(
  npub: string
): Promise<{ handle: string; space: string } | null> {
  const hit = npubCache.get(npub);
  if (hit && Date.now() - hit.at < NPUB_CACHE_TTL_MS) return hit.value;
  let value: { handle: string; space: string } | null = null;
  for (const space of KNOWN_SPACES) {
    const entries = blobStoreEnabled() ? await blobEntries(space) : (await fileRead(space)).entries;
    const match = entries.find((e) => e.npub === npub);
    if (match) {
      value = { handle: match.handle, space };
      break;
    }
  }
  npubCache.set(npub, { at: Date.now(), value });
  return value;
}

/** NIP-05 mapping (name -> hex pubkey) served at /.well-known/nostr.json */
export async function nip05Names(space?: string): Promise<Record<string, string>> {
  const { nip19 } = await import("nostr-tools");
  const s = normalizeSpace(space);
  const entries = blobStoreEnabled() ? await blobEntries(s) : (await fileRead(s)).entries;
  const names: Record<string, string> = {};
  for (const e of entries) {
    try {
      const decoded = nip19.decode(e.npub);
      if (decoded.type === "npub") names[e.handle] = decoded.data as string;
    } catch {
      // skip malformed entries rather than break verification for everyone
    }
  }
  return names;
}
