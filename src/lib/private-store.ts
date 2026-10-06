import { promises as fs } from "fs";
import path from "path";
import { get, list, del, BlobNotFoundError } from "@vercel/blob";
import { blobStoreEnabled } from "./registry";

/**
 * The private store — the vault the orders ride (store.ts) plus JSON
 * documents by key on the SAME driver. Operator documents (node settings,
 * briefs and reviews, sign-offs, rulings, the tickets board, the merges and
 * deploy logs, the artist roster, the store catalog) live here.
 *
 * Drivers, in order:
 * - vault: Upstash REST pair or REDIS_URL — whichever the platform provisioned;
 * - files under data/ — local development only;
 * - none: production without a vault. Reads fall back to the older blob
 *   copy (read only, so a site keeps running); writes are refused with an
 *   error that names what to configure. Nothing here ever writes a blob.
 *
 * Documents that older deployments kept in blob storage move over on read
 * (moveLegacyDoc): copy into the vault, read it back, compare, and only then
 * remove the old file. Any failed step serves the old content and removes
 * nothing. Once a document has its private copy, that copy is the document:
 * a write, or a prefix read that finds both, removes the older one.
 */

/**
 * The vault speaks two transports, whichever the platform provisioned:
 * - REST (Upstash KV_REST_API_URL/TOKEN pair) when present;
 * - native Redis over TCP via REDIS_URL — the only thing the current
 *   Vercel marketplace hands out. Lazy singleton client, reused across
 *   warm invocations, dropped on error so the next call reconnects.
 */
function restEnv(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

export function vaultConfigured(): boolean {
  return restEnv() !== null || !!process.env.REDIS_URL;
}

type RedisLike = { sendCommand: (cmd: string[]) => Promise<unknown> };
let redisClient: RedisLike | null = null;

async function getRedis(): Promise<RedisLike> {
  if (redisClient) return redisClient;
  const { createClient } = await import("redis");
  const client = createClient({
    url: process.env.REDIS_URL,
    socket: { connectTimeout: 5000 },
  });
  client.on("error", () => {
    redisClient = null; // next call reconnects instead of riding a dead socket
  });
  await client.connect();
  redisClient = client as unknown as RedisLike;
  return redisClient;
}

export async function kv(cmd: unknown[]): Promise<{ result: unknown } | null> {
  if (!vaultConfigured()) return null;
  const rest = restEnv();
  if (rest) {
    const res = await fetch(rest.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${rest.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`order store: KV ${res.status}`);
    return (await res.json()) as { result: unknown };
  }
  try {
    const client = await getRedis();
    const result = await client.sendCommand(cmd.map(String));
    return { result };
  } catch (err) {
    redisClient = null;
    throw new Error(`order store: redis ${err instanceof Error ? err.message : "error"}`);
  }
}

// ---------------------------------------------------------------------------
// Documents by key
// ---------------------------------------------------------------------------

/** A document: its key, and (dev driver only) where its file lives. */
export interface DocRef {
  key: string;
  /** dev file path; default is data/private-docs/<key> */
  file?: string;
}

const DOC_PREFIX = "store:doc:";
const DOC_INDEX = "store:docs:index";

const docKey = (key: string) => `${DOC_PREFIX}${key}`;
const defaultDir = (prefix: string) => path.join(process.cwd(), "data", "private-docs", prefix);
const docFile = (ref: DocRef) => ref.file ?? path.join(process.cwd(), "data", "private-docs", ref.key);

export const DOCS_NOT_CONFIGURED =
  "operator documents need a private store: set KV_REST_API_URL and KV_REST_API_TOKEN, or REDIS_URL";

type Driver = "vault" | "file" | "none";

/** Production = the platform, or any run that would reach the blob store. */
function driver(): Driver {
  if (vaultConfigured()) return "vault";
  if (process.env.VERCEL === "1" || blobStoreEnabled()) return "none";
  return "file";
}

/** True when writeDoc will be accepted (a vault, or the dev files). */
export function docsWritable(): boolean {
  return driver() !== "none";
}

// the older copies (read, list, remove — never write); swappable for tests
export interface LegacyBlob {
  read(pathname: string): Promise<string | null>;
  list(prefix: string): Promise<string[]>;
  remove(pathname: string): Promise<void>;
}

const blobLegacy: LegacyBlob = {
  async read(pathname) {
    const res = await get(pathname, { access: "public" });
    if (!res || res.statusCode !== 200) return null;
    return await new Response(res.stream).text();
  },
  async list(prefix) {
    const out: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor });
      out.push(...page.blobs.map((b) => b.pathname));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out;
  },
  async remove(pathname) {
    try {
      await del(pathname);
    } catch (err) {
      if (!(err instanceof BlobNotFoundError)) throw err; // already gone
    }
  },
};

let legacy: LegacyBlob = blobLegacy;

/** Tests only: stand in for the blob layer (no argument restores it). */
export function setLegacyBlobForTest(stub?: LegacyBlob): void {
  legacy = stub ?? blobLegacy;
}

async function legacyRead(pathname: string): Promise<string | null> {
  try {
    return await legacy.read(pathname);
  } catch {
    return null;
  }
}

/** The private copy is the document now: its older copy goes. Best effort. */
async function dropLegacy(pathname: string): Promise<void> {
  try {
    await legacy.remove(pathname);
  } catch {
    console.warn(`private store: older copy of ${pathname} not removed`);
  }
}

// -- the raw driver ---------------------------------------------------------

async function rawGet(ref: DocRef): Promise<string | null> {
  if (driver() === "vault") {
    const res = await kv(["GET", docKey(ref.key)]);
    return typeof res?.result === "string" ? res.result : null;
  }
  try {
    return await fs.readFile(docFile(ref), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw err;
  }
}

async function rawPut(ref: DocRef, text: string): Promise<void> {
  if (driver() === "vault") {
    await kv(["SADD", DOC_INDEX, ref.key]);
    await kv(["SET", docKey(ref.key), text]);
    return;
  }
  const p = docFile(ref);
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = p + ".tmp";
  await fs.writeFile(tmp, text, "utf8");
  await fs.rename(tmp, p);
}

/** Create-if-not-exists: true when this call created it. */
async function rawPutIfAbsent(ref: DocRef, text: string): Promise<boolean> {
  if (driver() === "vault") {
    await kv(["SADD", DOC_INDEX, ref.key]);
    const res = await kv(["SET", docKey(ref.key), text, "NX"]);
    return res?.result !== null;
  }
  const p = docFile(ref);
  await fs.mkdir(path.dirname(p), { recursive: true });
  try {
    await fs.writeFile(p, text, { encoding: "utf8", flag: "wx" });
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "EEXIST") return false;
    throw err;
  }
}

async function rawKeys(prefix: string, dir?: string): Promise<string[]> {
  if (driver() === "vault") {
    const res = await kv(["SMEMBERS", DOC_INDEX]);
    return Array.isArray(res?.result) ? (res.result as string[]).filter((k) => k.startsWith(prefix)) : [];
  }
  try {
    const files = await fs.readdir(dir ?? defaultDir(prefix));
    return files.filter((f) => f.endsWith(".json")).map((f) => prefix + f);
  } catch {
    return [];
  }
}

// -- the move ---------------------------------------------------------------

export interface MoveIO {
  readLegacy(): Promise<string | null>;
  readPrivate(): Promise<string | null>;
  /** true when this call created the private copy */
  putIfAbsent(text: string): Promise<boolean>;
  removeLegacy(): Promise<void>;
  /** one line, names the document, never its content */
  log(line: string): void;
}

/**
 * Move one document from its older blob copy into the private store.
 * Returns the text to serve, or null when there is no older copy.
 * Safe at the same moment from two requests (the create is
 * if-not-exists; removing twice is a no-op) and safe to run again.
 * Any failed step serves the older content and removes nothing.
 */
export async function moveLegacyDoc(name: string, io: MoveIO): Promise<string | null> {
  let old: string | null;
  try {
    old = await io.readLegacy();
  } catch {
    io.log(`private store: move of ${name} skipped, older copy unreadable`);
    return null;
  }
  if (old === null) return null;
  try {
    const created = await io.putIfAbsent(old);
    const back = await io.readPrivate();
    if (back !== old) {
      io.log(
        created
          ? `private store: move of ${name} not confirmed, read-back differs, older copy kept`
          : `private store: ${name} already has a different private copy, older copy kept`,
      );
      return created || back === null ? old : back;
    }
    try {
      await io.removeLegacy();
    } catch {
      io.log(`private store: move of ${name} done, older copy not removed`);
    }
    return old;
  } catch {
    io.log(`private store: move of ${name} failed, older copy kept`);
    return old;
  }
}

function moveIO(ref: DocRef): MoveIO {
  return {
    readLegacy: () => legacy.read(ref.key),
    readPrivate: () => rawGet(ref),
    putIfAbsent: (text) => rawPutIfAbsent(ref, text),
    removeLegacy: () => legacy.remove(ref.key),
    log: (line) => console.warn(line),
  };
}

// -- the public surface -----------------------------------------------------

/** One document's text, or null when there is none. */
export async function readDocText(ref: DocRef): Promise<string | null> {
  const d = driver();
  if (d === "none") return blobStoreEnabled() ? legacyRead(ref.key) : null; // read-only fallback
  const own = await rawGet(ref);
  if (own !== null) return own;
  if (d === "vault" && blobStoreEnabled()) {
    // null can also mean another request just finished the move: look again
    return (await moveLegacyDoc(ref.key, moveIO(ref))) ?? (await rawGet(ref));
  }
  return null;
}

/** One document, parsed; null when absent or malformed. */
export async function readDoc<T>(ref: DocRef): Promise<T | null> {
  const text = await readDocText(ref);
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Replace one document. Refused (naming what to configure) with no private store. */
export async function writeDocText(ref: DocRef, text: string): Promise<void> {
  const d = driver();
  if (d === "none") throw new Error(DOCS_NOT_CONFIGURED);
  await rawPut(ref, text);
  if (d === "vault" && blobStoreEnabled()) await dropLegacy(ref.key);
}

export async function writeDoc(ref: DocRef, value: unknown, pretty = true): Promise<void> {
  await writeDocText(ref, pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value));
}

/** The text of every document under a key prefix (older copies move on the way). */
export async function readDocTexts(prefix: string, dir?: string): Promise<string[]> {
  const d = driver();
  if (d === "none") {
    if (!blobStoreEnabled()) return [];
    let keys: string[] = [];
    try {
      keys = await legacy.list(prefix);
    } catch {
      /* unreadable — an honest empty */
    }
    const texts = await Promise.all(keys.map((k) => legacyRead(k)));
    return texts.filter((t): t is string => t !== null);
  }
  const own = await rawKeys(prefix, dir);
  const texts = await Promise.all(own.map((key) => rawGet({ key, file: dir ? path.join(dir, key.slice(prefix.length)) : undefined })));
  const out = texts.filter((t): t is string => t !== null);
  if (d === "vault" && blobStoreEnabled()) {
    // an index entry with no document behind it does not count as a private copy
    const have = new Set(own.filter((_, i) => texts[i] !== null));
    let found: string[] = [];
    try {
      found = await legacy.list(prefix);
    } catch {
      /* unreadable — serve what the vault has */
    }
    const older = found.filter((k) => !have.has(k));
    await Promise.all(found.filter((k) => have.has(k)).map((k) => dropLegacy(k)));
    const moved = await Promise.all(
      older.map(async (key) => (await moveLegacyDoc(key, moveIO({ key }))) ?? (await rawGet({ key }))),
    );
    out.push(...moved.filter((t): t is string => t !== null));
  }
  return out;
}
