import { promises as fs } from "fs";
import path from "path";
import { put, get } from "@vercel/blob";
import { verifyEvent } from "nostr-tools";
import { blobStoreEnabled } from "./registry";
import { isOperatorHex } from "./operator-auth";
import { effectiveGithub } from "./nodeconfig";

/**
 * Merge authorizations — the admiral signs merges from the SCAR console.
 *
 * An authorization is a per-action nostr signature binding the PR number AND
 * the exact head commit: content `PACS-MERGE-<pr>-<headSha>-<ts>`, kind 22242,
 * signed by an allowlisted operator key. You authorize THAT code — if the
 * branch moves, the signature no longer matches and GitHub's sha-guarded
 * merge refuses. Every authorization is recorded (dual-driver, like tickets)
 * as an audit trail.
 *
 * With GITHUB_TOKEN configured (contents+pull-requests write), a verified
 * authorization also EXECUTES the merge. Without it, the signed go-ahead is
 * recorded and the merge happens on GitHub — the signature is the sign-off
 * either way. Someday the log itself gets tied to the block.
 */

const GH = "https://api.github.com";

/** GitHub link: stored config first (pasted in the SCAR panel), env fallback. */
async function ghContext(): Promise<{ repo: string; headers: Record<string, string>; hasToken: boolean }> {
  const { repo, token } = await effectiveGithub();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "frens-earth-scar",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return { repo, headers, hasToken: !!token };
}

export async function mergeExecutionEnabled(): Promise<boolean> {
  return (await ghContext()).hasToken;
}

export interface OpenPr {
  number: number;
  title: string;
  branch: string;
  headSha: string;
  url: string;
  draft: boolean;
}

/** GitHub reports a fine-grained key's real expiry as a header on every
    response — captured per request so the queue (and someday the ship's
    calendar) can surface renewal before it bites. */
let tokenExpiry: string | null = null;
export function tokenExpiration(): string | null {
  return tokenExpiry;
}

/** Open PRs from GitHub (a private repo needs the token to even list). */
export async function listOpenPrs(): Promise<OpenPr[]> {
  const { repo, headers } = await ghContext();
  const res = await fetch(`${GH}/repos/${repo}/pulls?state=open&per_page=20`, {
    headers,
    cache: "no-store",
  });
  tokenExpiry = res.headers.get("github-authentication-token-expiration");
  if (!res.ok) throw new Error(`GitHub said ${res.status}`);
  const prs = (await res.json()) as {
    number: number;
    title: string;
    head: { ref: string; sha: string };
    html_url: string;
    draft: boolean;
  }[];
  return prs.map((p) => ({
    number: p.number,
    title: p.title,
    branch: p.head.ref,
    headSha: p.head.sha,
    url: p.html_url,
    draft: p.draft,
  }));
}

export interface PrFile {
  file: string;
  status: string; // added | modified | removed | renamed
  additions: number;
  deletions: number;
}

/** The change list for one proposal — every touched file with its adds and
    removes, so the captain can review right in the queue (VS-Code style). */
export async function listPrFiles(pr: number): Promise<PrFile[]> {
  const { repo, headers } = await ghContext();
  const res = await fetch(`${GH}/repos/${repo}/pulls/${pr}/files?per_page=100`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub said ${res.status}`);
  const files = (await res.json()) as {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
  }[];
  return files.map((f) => ({
    file: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
  }));
}

// ── the audit log (dual driver, same pattern as tickets) ────────────────────

export interface MergeAuth {
  pr: number;
  headSha: string;
  by: string; // operator pubkey hex
  sig: string; // the signature — the record IS the proof
  at: string;
  merged: boolean;
  mergeNote?: string;
  closed?: boolean; // the change stays on the admiral's queue until closed
}

/** The admiral's close-out — the signature OPENS a change; only the close
    ends it (merge → deploy → test → bug-or-close; ITSM, arcade style). */
export async function closeAuthorization(pr: number): Promise<boolean> {
  const log = await readLog();
  let hit = false;
  for (const e of log) {
    if (e.pr === pr && !e.closed) {
      e.closed = true;
      hit = true;
    }
  }
  if (hit) await writeLog(log);
  return hit;
}

const BLOB_PATH = "merges/log.json";
const filePath = () => path.join(process.cwd(), "data", "merges.json");

async function readLog(): Promise<MergeAuth[]> {
  if (blobStoreEnabled()) {
    try {
      const res = await get(BLOB_PATH, { access: "public" });
      if (res && res.statusCode === 200) return JSON.parse(await new Response(res.stream).text());
    } catch {
      /* start empty */
    }
    return [];
  }
  try {
    return JSON.parse(await fs.readFile(filePath(), "utf8"));
  } catch {
    return [];
  }
}

async function writeLog(log: MergeAuth[]): Promise<void> {
  const body = JSON.stringify(log, null, 2);
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
  await fs.writeFile(p, body, "utf8");
}

export function listAuthorizations(): Promise<MergeAuth[]> {
  return readLog();
}

// ── the authorization itself ────────────────────────────────────────────────

const CHALLENGE_WINDOW_MS = 5 * 60 * 1000;

/** Verify a signed merge authorization and record it; execute the merge when
    a GITHUB_TOKEN is configured. The sha in the signed content is passed to
    GitHub's sha-guarded merge — stale authorizations can never merge moved
    branches. */
export async function authorizeMerge(event: {
  content?: string;
  pubkey?: string;
  sig?: string;
  kind?: number;
  created_at?: number;
  tags?: unknown;
  id?: string;
}): Promise<
  | { ok: true; pr: number; merged: boolean; note: string }
  | { ok: false; reason: string }
> {
  if (!event?.content || !event.pubkey || !event.sig) {
    return { ok: false, reason: "signed authorization required" };
  }
  const m = event.content.match(/^PACS-MERGE-(\d+)-([0-9a-f]{40})-(\d+)$/);
  if (!m) return { ok: false, reason: "not a merge authorization" };
  const [, prStr, sha, ts] = m;
  const pr = Number(prStr);
  if (Math.abs(Date.now() - Number(ts)) > CHALLENGE_WINDOW_MS) {
    return { ok: false, reason: "authorization expired — sign a fresh one" };
  }
  if (!isOperatorHex(event.pubkey)) {
    return { ok: false, reason: "that key isn't on this site's operator list" };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!verifyEvent(event as any)) {
    return { ok: false, reason: "signature check failed" };
  }

  const entry: MergeAuth = {
    pr,
    headSha: sha,
    by: event.pubkey,
    sig: event.sig,
    at: new Date().toISOString(),
    merged: false,
  };

  const gh = await ghContext();
  let note = "authorization recorded — merge on GitHub (no token connected)";
  if (gh.hasToken) {
    try {
      const res = await fetch(`${GH}/repos/${gh.repo}/pulls/${pr}/merge`, {
        method: "PUT",
        headers: { ...gh.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ merge_method: "merge", sha }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        entry.merged = true;
        note = "merged ✓";
      } else {
        note = `authorization recorded — GitHub refused the merge: ${data.message ?? res.status}`;
      }
    } catch {
      note = "authorization recorded — couldn't reach GitHub; merge it there";
    }
  }
  entry.mergeNote = note;

  const log = await readLog();
  log.push(entry);
  await writeLog(log);
  return { ok: true, pr, merged: entry.merged, note };
}
