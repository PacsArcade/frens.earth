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

/** Aggregated read-cache blob. Underscore-prefixed so it can never collide
    with a real handle (validateHandle forbids a leading '_'); listings and
    counts skip it so it is never mistaken for a claim. */
function indexPath(space: string): string {
  return `registry/${space}/_index.json`;
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

/** Total claims in a space (metadata only — no content fetches). Skips the
    aggregated index blob so it is never counted as a claim. */
async function blobCount(space: string): Promise<number> {
  const idx = indexPath(space);
  let count = 0;
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: blobPrefix(space), cursor });
    count += page.blobs.filter((b) => b.pathname !== idx).length;
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return count;
}

/** Every claim in a space, read straight from the authoritative per-handle
    blobs (one content fetch each — the N+1 the index cache exists to avoid).
    Skips the aggregated index blob so it is never parsed as a handle. */
async function blobEntries(space: string): Promise<HandleEntry[]> {
  const idx = indexPath(space);
  const entries: HandleEntry[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: blobPrefix(space), cursor });
    const contents = await Promise.all(
      page.blobs
        .filter((b) => b.pathname !== idx)
        .map(async (b) => {
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
// Aggregated index cache (Blob driver)
//
// The per-handle blobs above stay AUTHORITATIVE: they back the atomic
// allowOverwrite:false uniqueness check, and isAvailable/claimHandle read them
// directly (via blobExists) — never this index. The index is a REBUILDABLE
// CACHE, one blob per space mapping handle -> HandleEntry, so the hot read
// paths (nip05Names, findHandleByNpub) cost ~1 content fetch instead of one
// get() per handle.
//
// Write-through: every mutation funnels through reindex() — the SINGLE index
// hook. claimHandle adds, releaseHandle removes, updateEntry patches. A1's
// future batch-commit writer must call reindex() too, so the index stays warm
// after a batch flip instead of being invalidated wholesale.
//
// Consistency trade-off: the index is written with allowOverwrite:true, so two
// simultaneous mutations that both read-modify-write it can drop one change
// (last writer wins). This is tolerated because (a) availability and claim read
// the authoritative per-handle blob, so a lost index update can NEVER permit a
// double-claim, and (b) reads self-heal — a missing index, or a findHandleByNpub
// lookup miss (which may be a dropped write), rebuilds the index from the
// authoritative blobs and re-checks. A dropped entry is therefore eventually
// restored; correctness never depends on the cache being current.
// ---------------------------------------------------------------------------

/** Build the index map straight from the authoritative per-handle blobs. */
async function blobBuildIndexMap(space: string): Promise<Record<string, HandleEntry>> {
  const map: Record<string, HandleEntry> = {};
  for (const e of await blobEntries(space)) map[e.handle] = e;
  return map;
}

/** Fetch the aggregated index blob, or null if absent/unreadable. */
async function blobReadIndex(space: string): Promise<Record<string, HandleEntry> | null> {
  try {
    const res = await get(indexPath(space), { access: "public" });
    if (!res || res.statusCode !== 200) return null;
    return JSON.parse(await new Response(res.stream).text()) as Record<string, HandleEntry>;
  } catch {
    return null; // missing or malformed — caller rebuilds from authoritative blobs
  }
}

/** Persist the index cache. allowOverwrite:true — it is a cache, not the
    uniqueness-bearing record, so overwriting is expected (see the note above). */
async function blobWriteIndex(space: string, index: Record<string, HandleEntry>): Promise<void> {
  await put(indexPath(space), JSON.stringify(index), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

/** Rebuild the index from the authoritative blobs and persist it best-effort.
    Persist failure is swallowed: the freshly built map is still returned, so a
    read never breaks just because the cache could not be refreshed. */
async function blobRebuildIndex(space: string): Promise<Record<string, HandleEntry>> {
  const rebuilt = await blobBuildIndexMap(space);
  try {
    await blobWriteIndex(space, rebuilt);
  } catch {
    // cache stayed stale; the next read that needs it will heal it again
  }
  return rebuilt;
}

/** The ONE index-mutation hook. Read-modify-write, rebuilding a missing cache
    first so a cold index heals on the next mutation. Best-effort by design:
    the authoritative per-handle blob is already written by the time we get
    here, so a failed index update must never fail the mutation — it just
    leaves a stale entry for a read to self-heal.
    A1's batch-commit writer should route its status flips through here too. */
async function reindex(
  space: string,
  mutate: (index: Record<string, HandleEntry>) => void
): Promise<void> {
  try {
    const index = (await blobReadIndex(space)) ?? (await blobBuildIndexMap(space));
    mutate(index);
    await blobWriteIndex(space, index);
  } catch {
    // index is a cache — leave it stale rather than fail the mutation
  }
}

/** Hot-path entry list: the aggregated index in one content fetch, rebuilding
    (and persisting) a missing cache. Warm-cache happy path is ~1 fetch. */
async function blobIndexEntries(space: string): Promise<HandleEntry[]> {
  const cached = await blobReadIndex(space);
  if (cached) return Object.values(cached);
  return Object.values(await blobRebuildIndex(space)); // cold cache — self-heal
}

/** Reverse lookup within one space via the index cache. A cache HIT is ~1
    content fetch. A miss might be a dropped index write, so we rebuild from the
    authoritative blobs and re-check before trusting the miss — the self-heal
    for the concurrent-write race. (This is no costlier than the pre-index code,
    which scanned every blob on a miss anyway; the win is that hits now cost 1.) */
async function blobFindByNpub(space: string, npub: string): Promise<HandleEntry | null> {
  const index = await blobReadIndex(space);
  if (index) {
    const hit = Object.values(index).find((e) => e.npub === npub);
    if (hit) return hit;
  }
  const rebuilt = await blobRebuildIndex(space);
  return Object.values(rebuilt).find((e) => e.npub === npub) ?? null;
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
    // Authoritative blob is committed above; warm the read-cache write-through.
    await reindex(s, (index) => {
      index[valid.handle] = entry;
    });
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
      // Authoritative record rewritten above; patch the read-cache too.
      await reindex(s, (index) => {
        index[handle] = next;
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
    // Authoritative blob removed above; drop it from the read-cache too.
    await reindex(s, (index) => {
      delete index[handle];
    });
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
   space; positive results cached briefly. Two lessons from the pacster
   double-door sign-in (2026-07-07): NEVER cache a miss (one transient read
   hiccup made "no tag" sticky for a minute), and when a key holds tags in
   more than one space, the HOST's door wins — signing in on pacsarcade.org
   should land the school tag, not whichever space scans first. */
const npubCache = new Map<string, { at: number; value: { handle: string; space: string } }>();
const NPUB_CACHE_TTL_MS = 60_000;

export async function findHandleByNpub(
  npub: string,
  preferSpace?: string
): Promise<{ handle: string; space: string } | null> {
  const hit = npubCache.get(npub);
  if (
    hit &&
    Date.now() - hit.at < NPUB_CACHE_TTL_MS &&
    (!preferSpace || hit.value.space === preferSpace)
  ) {
    return hit.value;
  }

  const spaces = [...KNOWN_SPACES] as string[];
  if (preferSpace && spaces.includes(preferSpace)) {
    spaces.splice(spaces.indexOf(preferSpace), 1);
    spaces.unshift(preferSpace);
  }

  for (const space of spaces) {
    const match = blobStoreEnabled()
      ? await blobFindByNpub(space, npub) // index cache, self-healing on a miss
      : (await fileRead(space)).entries.find((e) => e.npub === npub) ?? null;
    if (match) {
      const value = { handle: match.handle, space };
      npubCache.set(npub, { at: Date.now(), value });
      return value;
    }
  }
  /* no match: return null WITHOUT caching — the next attempt re-scans */
  return null;
}

/** NIP-05 mapping (name -> hex pubkey) served at /.well-known/nostr.json */
export async function nip05Names(space?: string): Promise<Record<string, string>> {
  const { nip19 } = await import("nostr-tools");
  const s = normalizeSpace(space);
  const entries = blobStoreEnabled() ? await blobIndexEntries(s) : (await fileRead(s)).entries;
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
