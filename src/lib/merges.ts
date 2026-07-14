import { promises as fs } from "fs";
import path from "path";
import { put, get } from "@vercel/blob";
import { verifyEvent, nip19 } from "nostr-tools";
import { blobStoreEnabled, findHandleByNpub } from "./registry";
import { isOperatorHex } from "./operator-auth";
import { effectiveGithub } from "./nodeconfig";
import { bftDateTime } from "./bb/bft";
import { serverBlockInfo } from "./chain-tip-server";

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
 *
 * Review NOTES ride the same rails: content `PACS-NOTE-<pr>-<ts>\n<body>`,
 * verified identically, appended to this same log (kind: "note"), and — when
 * the token is connected — posted onto the PR's GitHub conversation with a
 * footer citing the signature.
 */

/** The BFT stamp for a SIGNED record, from the REAL block — our own node first
    (sovereign truth), mempool.space only if it's dark, a genesis estimate (the
    honest `~ `) only if both are unreachable. A signature must carry true block
    time, not the sun-time guess `estimateHeight()` returns (which lags the chain
    by months, since early blocks ran faster than ten minutes). The ladder lives
    in serverBlockInfo() (chain-tip-server.ts) — the one server tip for every
    record-writer. */
async function signingStamp(): Promise<string> {
  const { height, estimated } = await serverBlockInfo();
  return estimated ? `~ ${bftDateTime(height)}` : bftDateTime(height);
}

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

/** The change's own brief — title + body of the PR (open OR merged), so the
    IN FLIGHT board can tell the admiral WHAT TO TEST in the change's own
    words. */
export async function getPrBrief(pr: number): Promise<{ title: string; body: string }> {
  const { repo, headers } = await ghContext();
  const res = await fetch(`${GH}/repos/${repo}/pulls/${pr}`, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`GitHub said ${res.status}`);
  const data = (await res.json()) as { title: string; body: string | null };
  return { title: data.title, body: data.body ?? "" };
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
  kind?: "note"; // absent = merge authorization (records predating notes stay valid)
  note?: string; // the note body, exactly as signed (kind "note" entries only)
  shipped?: boolean; // the operator has ▲ SHIPped this merge — merge ≠ live until this
  shippedAt?: string; // when ▲ SHIP fired (ISO), for ordering/audit
}

/** The admiral's close-out — the signature OPENS a change; only the close
    ends it (merge → deploy → test → bug-or-close; ITSM, arcade style). */
export async function closeAuthorization(pr: number): Promise<boolean> {
  const log = await readLog();
  let hit = false;
  for (const e of log) {
    if (e.pr === pr && !e.closed && e.kind !== "note") {
      e.closed = true;
      hit = true;
    }
  }
  if (hit) await writeLog(log);
  return hit;
}

/** ▲ SHIP — mark the given merged changes as shipped. The operator's one deploy
    ships the current main (every merged-pending change together), so we stamp
    each un-shipped merged record `shipped:true` here. This is what keeps a
    merged card on Action Items until it's explicitly shipped — merge ≠ live —
    and then, once the new build's stamp overtakes the merge time, it crosses to
    Bug Testing. Recorded, not fragile: an unrelated redeploy can no longer yank
    a not-yet-shipped card off the board. */
export async function markShipped(prs: number[]): Promise<boolean> {
  const want = new Set(prs);
  const log = await readLog();
  const at = new Date().toISOString();
  let hit = false;
  for (const e of log) {
    if (e.kind !== "note" && !e.closed && e.merged && want.has(e.pr) && !e.shipped) {
      e.shipped = true;
      e.shippedAt = at;
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
    shipped: false, // merge ≠ live: the record is kept, un-shipped, so the card stays
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

// ── signed review notes ─────────────────────────────────────────────────────

/** Verify a signed review note and record it; with a GitHub token connected,
    post it onto the PR's conversation too. The signature covers the note's
    exact words — content `PACS-NOTE-<pr>-<ts>\n<body>`, kind 22242, an
    allowlisted operator key — so the GitHub comment can cite a signature
    anyone can check against the audit log. Same verification ladder as
    authorizeMerge: shape → freshness → allowlist → signature. */
export async function postNote(event: {
  content?: string;
  pubkey?: string;
  sig?: string;
  kind?: number;
  created_at?: number;
  tags?: unknown;
  id?: string;
}): Promise<
  | { ok: true; pr: number; posted: boolean; note: string }
  | { ok: false; reason: string }
> {
  if (!event?.content || !event.pubkey || !event.sig) {
    return { ok: false, reason: "signed note required" };
  }
  const m = event.content.match(/^PACS-NOTE-(\d+)-(\d+)\n([\s\S]+)$/);
  if (!m) return { ok: false, reason: "not a signed note" };
  const [, prStr, ts, body] = m;
  const pr = Number(prStr);
  if (Math.abs(Date.now() - Number(ts)) > CHALLENGE_WINDOW_MS) {
    return { ok: false, reason: "note expired — sign a fresh one" };
  }
  if (!isOperatorHex(event.pubkey)) {
    return { ok: false, reason: "that key isn't on this site's operator list" };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!verifyEvent(event as any)) {
    return { ok: false, reason: "signature check failed" };
  }

  /* the footer ties the comment back to the signature — SIGNER FIRST (the
     admiral's order): who (fren tag, short-npub fallback), then "signed via
     SCAR·LET at" the true-block BFT stamp (the old calendar is burned), then
     the sig's leading bytes, checkable against this log's full record. */
  const npub = nip19.npubEncode(event.pubkey);
  const shortNpub = `${npub.slice(0, 7)}…${npub.slice(-4)}`;
  // prefer the captain's fren tag (name@space) + the npub's last four in parens;
  // fall back to the short npub if they hold no tag yet.
  const owner = await findHandleByNpub(npub).catch(() => null);
  const who = owner ? `${owner.handle}@${owner.space} (${npub.slice(-4)})` : shortNpub;
  const footer = `\n\n—— ✍ ${who} signed via SCAR·LET at ${await signingStamp()} a₿ · sig ${event.sig.slice(0, 16)}…`;

  const gh = await ghContext();
  let posted = false;
  let note = "recorded — connect GitHub to post it there";
  if (gh.hasToken) {
    try {
      const res = await fetch(`${GH}/repos/${gh.repo}/issues/${pr}/comments`, {
        method: "POST",
        headers: { ...gh.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ body: body + footer }),
      });
      if (res.ok) {
        posted = true;
        note = "posted to the PR on GitHub ✓";
      } else {
        const data = await res.json().catch(() => ({}));
        note = `recorded — GitHub refused the comment: ${data.message ?? res.status}`;
      }
    } catch {
      note = "recorded — couldn't reach GitHub; the note is safe in the log";
    }
  }

  const entry: MergeAuth = {
    kind: "note",
    pr,
    headSha: "",
    by: event.pubkey,
    sig: event.sig,
    at: new Date().toISOString(),
    merged: false,
    mergeNote: note,
    note: body,
  };
  const log = await readLog();
  log.push(entry);
  await writeLog(log);
  return { ok: true, pr, posted, note };
}
