import { promises as fs } from "fs";
import path from "path";
import { put, get, list } from "@vercel/blob";
import { verifyEvent } from "nostr-tools";
import { blobStoreEnabled } from "./registry";
import { isOperatorHex } from "./operator-auth";
import { effectiveGithub, effectiveBriefsRepo } from "./nodeconfig";
import { currentBlockInfo } from "./bb/bft";

/**
 * Briefs library — the design briefs as reviewable tickets in SCAR.
 *
 * ── PRIVACY (the hard rule) ─────────────────────────────────────────────────
 * This repo is PUBLIC and the briefs are internal strategy, so brief CONTENT
 * NEVER touches git. It lives ONLY in the dual-driver store — a single doc per
 * brief in Vercel Blob (prod) or a GITIGNORED data/briefs/ dir (dev) — exactly
 * the pattern decisions/merges/registry use for their records. The committed
 * code here is the reader + the store + the puller; it carries ZERO content.
 *
 * ── SOURCE ──────────────────────────────────────────────────────────────────
 * Content is PULLED from a private, captains-only GitHub repo (briefsRepo in
 * the node config, default PacsArcade/frens-briefs) using the operator's
 * connected PAT — the SAME fine-grained token the merge queue uses, which needs
 * Contents:read on that repo. The pull writes each `*.md` straight into the
 * store above. `scripts/sync-briefs.mjs` is a secondary dev convenience that
 * does the same from a local sibling folder.
 *
 * ── REVIEWS ─────────────────────────────────────────────────────────────────
 * Each brief carries at most one review record — a sign-off or a send-back,
 * BFT-stamped, and bound to a per-action operator signature
 * (`PACS-BRIEF-<slug>-<ts>-<signoff|sendback>`), the console's signed-action
 * model. Reviews store per-item (one blob per slug in prod, one JSON file in
 * dev) so they never clobber each other — the same fix decisions' rulings use.
 * Writes are operator-gated in the API route AND signature-verified here.
 */

export interface BriefContent {
  slug: string;
  title: string;
  body: string; // markdown
  source?: string; // where it came from (filename / repo path)
}

export type BriefStatus = "unreviewed" | "revise" | "signed";

export interface BriefReview {
  slug: string;
  status: "signed" | "revise"; // signed off, or sent back for another pass
  comment?: string;
  at: number; // block height at record — the block IS the record
  by?: string; // operator pubkey hex
  sig?: string; // the per-action signature — the record IS the proof
}

/** A brief joined with its latest review — the shape the UI reads. */
export interface Brief extends BriefContent {
  status: BriefStatus;
  comment?: string;
  at?: number;
  by?: string;
  sig?: string;
}

// ── storage paths ───────────────────────────────────────────────────────────
// Content: one doc per brief. Reviews: one record per brief (never a shared
// doc — see the decisions store for why eventually-consistent blob reads make a
// read-modify-write of a shared doc clobber concurrent writes).
const CONTENT_BLOB_DIR = "briefs/content/";
const REVIEW_BLOB_DIR = "briefs/reviews/";
const contentBlobPath = (slug: string) => `${CONTENT_BLOB_DIR}${slug}.json`;
const reviewBlobPath = (slug: string) => `${REVIEW_BLOB_DIR}${slug}.json`;

/** Local dev store — GITIGNORED (see .gitignore). Content is one file per
    brief under data/briefs/; reviews are a single data/brief-reviews.json (one
    dev process → no clobber). */
function contentDir(): string {
  return path.join(process.cwd(), "data", "briefs");
}
function contentFilePath(slug: string): string {
  return path.join(contentDir(), `${slug}.json`);
}
function reviewsFilePath(): string {
  return path.join(process.cwd(), "data", "brief-reviews.json");
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

/** Filename/path → a URL-safe, stable slug. Kept in lockstep with the same
    derivation in scripts/sync-briefs.mjs so both paths key content identically. */
export function briefSlug(raw: string): string {
  return raw
    .replace(/\.md$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Split a markdown doc into a display title + body. A leading `# H1` becomes
    the title and is dropped from the body (so the reader shows it once, in the
    card header); with no H1, the prettified filename is the title and the whole
    doc is the body. */
export function parseBrief(markdown: string, filename: string): { title: string; body: string } {
  const text = markdown.replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  let title = "";
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "") continue;
    const m = lines[i].match(/^#\s+(.+?)\s*#*\s*$/);
    if (m) {
      title = m[1].trim();
      bodyStart = i + 1;
    }
    break; // only inspect the first non-empty line
  }
  if (!title) {
    title = filename
      .replace(/\.md$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const body = lines.slice(bodyStart).join("\n").replace(/^\n+/, "").trimEnd();
  return { title, body };
}

// ── content store (dual driver) ─────────────────────────────────────────────

export async function listBriefContents(): Promise<BriefContent[]> {
  if (blobStoreEnabled()) {
    const out: BriefContent[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: CONTENT_BLOB_DIR, cursor });
      const texts = await Promise.all(page.blobs.map((b) => readBlobText(b.pathname)));
      for (const t of texts) {
        if (!t) continue;
        try {
          const c = JSON.parse(t) as BriefContent;
          if (c?.slug) out.push(c);
        } catch {
          /* skip a malformed doc rather than break the library */
        }
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out;
  }
  try {
    const dir = contentDir();
    const files = await fs.readdir(dir);
    const out: BriefContent[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const c = JSON.parse(await fs.readFile(path.join(dir, f), "utf8")) as BriefContent;
        if (c?.slug) out.push(c);
      } catch {
        /* skip a malformed doc */
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function getBriefContent(slug: string): Promise<BriefContent | null> {
  if (blobStoreEnabled()) {
    const t = await readBlobText(contentBlobPath(slug));
    if (!t) return null;
    try {
      return JSON.parse(t) as BriefContent;
    } catch {
      return null;
    }
  }
  try {
    return JSON.parse(await fs.readFile(contentFilePath(slug), "utf8")) as BriefContent;
  } catch {
    return null;
  }
}

/** Write one brief into the store — used by the repo puller and the dev sync
    script's blob path. The content lands in Blob (prod) or the gitignored
    data/briefs/ dir (dev); it is NEVER committed to this public repo. */
export async function putBriefContent(brief: BriefContent): Promise<void> {
  const body = JSON.stringify(brief, null, 2);
  if (blobStoreEnabled()) {
    await put(contentBlobPath(brief.slug), body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }
  const p = contentFilePath(brief.slug);
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = p + ".tmp";
  await fs.writeFile(tmp, body, "utf8");
  await fs.rename(tmp, p);
}

// ── review store (dual driver, per-item) ────────────────────────────────────

async function readReviews(): Promise<BriefReview[]> {
  if (blobStoreEnabled()) {
    const bySlug = new Map<string, BriefReview>();
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: REVIEW_BLOB_DIR, cursor });
      const texts = await Promise.all(page.blobs.map((b) => readBlobText(b.pathname)));
      for (const t of texts) {
        if (!t) continue;
        try {
          const r = JSON.parse(t) as BriefReview;
          if (r?.slug) bySlug.set(r.slug, r);
        } catch {
          /* skip a malformed review */
        }
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return [...bySlug.values()];
  }
  try {
    return (JSON.parse(await fs.readFile(reviewsFilePath(), "utf8")) as { reviews: BriefReview[] })
      .reviews ?? [];
  } catch {
    return [];
  }
}

async function writeReview(review: BriefReview): Promise<void> {
  if (blobStoreEnabled()) {
    await put(reviewBlobPath(review.slug), JSON.stringify(review), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }
  // dev only — single process, so a plain file read-modify-write is safe
  const p = reviewsFilePath();
  let store: { reviews: BriefReview[] } = { reviews: [] };
  try {
    store = JSON.parse(await fs.readFile(p, "utf8")) as { reviews: BriefReview[] };
    if (!Array.isArray(store.reviews)) store.reviews = [];
  } catch {
    /* first write — start empty */
  }
  const i = store.reviews.findIndex((r) => r.slug === review.slug);
  if (i >= 0) store.reviews[i] = review;
  else store.reviews.push(review);
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = p + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
  await fs.rename(tmp, p);
}

// ── the joined view ─────────────────────────────────────────────────────────

function join(content: BriefContent, review?: BriefReview): Brief {
  if (!review) return { ...content, status: "unreviewed" };
  return {
    ...content,
    status: review.status === "revise" ? "revise" : "signed",
    comment: review.comment,
    at: review.at,
    by: review.by,
    sig: review.sig,
  };
}

/** Every brief with its review status merged on top. Order: unreviewed first
    (needs the admiral), then sent-back (awaiting rework), then signed — the
    latter two newest-block first, unreviewed alphabetical. */
export async function listBriefs(): Promise<Brief[]> {
  const [contents, reviews] = await Promise.all([listBriefContents(), readReviews()]);
  const bySlug = new Map(reviews.map((r) => [r.slug, r]));
  const merged = contents.map((c) => join(c, bySlug.get(c.slug)));
  const rank = { unreviewed: 0, revise: 1, signed: 2 } as const;
  return merged.sort((a, b) => {
    if (a.status !== b.status) return rank[a.status] - rank[b.status];
    if (a.status === "unreviewed") return a.title.localeCompare(b.title);
    return (b.at ?? 0) - (a.at ?? 0);
  });
}

export async function getBrief(slug: string): Promise<Brief | null> {
  const content = await getBriefContent(slug);
  if (!content) return null;
  const review = (await readReviews()).find((r) => r.slug === slug);
  return join(content, review);
}

// ── recording a signed review ───────────────────────────────────────────────

const CHALLENGE_WINDOW_MS = 5 * 60 * 1000;
/* content: `PACS-BRIEF-<slug>-<unix-ms>-<signoff|sendback>` + optional
   `\n<comment>`. The action is pinned to the END so the slug's own hyphens and
   internal digits stay unambiguous (greedy slug, then `-<digits>-<action>`). */
const BRIEF_ACTION_RE = /^PACS-BRIEF-(.+)-(\d+)-(signoff|sendback)(?:\n([\s\S]*))?$/;

/**
 * Verify a signed brief review and record it. Same verification ladder as the
 * merge authorization: shape → freshness → operator allowlist → signature. A
 * sign-off records `signed`; a send-back records `revise` and REQUIRES a
 * comment (it's the whole point — it says what to change). The operator cookie
 * gate lives in the API route; this is the signature layer.
 */
export async function recordReview(event: {
  content?: string;
  pubkey?: string;
  sig?: string;
  kind?: number;
  created_at?: number;
  tags?: unknown;
  id?: string;
}): Promise<{ ok: true; brief: Brief } | { ok: false; reason: string }> {
  if (!event?.content || !event.pubkey || !event.sig) {
    return { ok: false, reason: "signed review required" };
  }
  const m = event.content.match(BRIEF_ACTION_RE);
  if (!m) return { ok: false, reason: "not a brief review action" };
  const [, slug, ts, action, rawComment] = m;
  if (Math.abs(Date.now() - Number(ts)) > CHALLENGE_WINDOW_MS) {
    return { ok: false, reason: "review expired — sign a fresh one" };
  }
  if (!isOperatorHex(event.pubkey)) {
    return { ok: false, reason: "that key isn't on this site's operator list" };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!verifyEvent(event as any)) {
    return { ok: false, reason: "signature check failed" };
  }

  const content = await getBriefContent(slug);
  if (!content) return { ok: false, reason: "no such brief in the library" };

  const comment = (rawComment ?? "").trim().slice(0, 4000) || undefined;
  if (action === "sendback" && !comment) {
    return { ok: false, reason: "a send-back needs a comment — say what to change" };
  }

  const { height } = await currentBlockInfo();
  const review: BriefReview = {
    slug,
    status: action === "sendback" ? "revise" : "signed",
    comment,
    at: height,
    by: event.pubkey,
    sig: event.sig,
  };
  await writeReview(review);
  return { ok: true, brief: join(content, review) };
}

// ── the pull from the private briefs repo ───────────────────────────────────

const GH = "https://api.github.com";

export interface PullResult {
  ok: boolean;
  /** honest state when it can't run — mirrors the merge queue's connect box */
  reason?: "connect-github" | "unreachable" | "empty";
  detail?: string;
  repo?: string;
  branch?: string;
  count?: number; // briefs written
  slugs?: string[];
}

interface GitTreeEntry {
  path: string;
  type: string;
  sha: string;
}

/**
 * Pull every `*.md` from the private briefs repo into the store, using the
 * operator's connected GitHub token (Contents:read on that repo). Reads the
 * recursive tree, fetches each markdown blob, parses it, and writes it via
 * putBriefContent — content flows repo → store, NEVER into this public repo.
 * Returns an honest `reason` when there's no token / the repo is unreachable /
 * it's empty, so the UI can show the same "not connected" states as the merge
 * queue and MempoolPanel.
 */
export async function pullBriefsFromRepo(): Promise<PullResult> {
  const { token } = await effectiveGithub();
  const { repo, branch } = await effectiveBriefsRepo();
  if (!token) {
    return {
      ok: false,
      reason: "connect-github",
      repo,
      branch,
      detail:
        "no GitHub token connected — connect the console's PAT (needs Contents:read on the briefs repo) in the merge queue",
    };
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "frens-earth-scar",
    Authorization: `Bearer ${token}`,
  };

  let tree: GitTreeEntry[];
  try {
    const res = await fetch(`${GH}/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      return {
        ok: false,
        reason: "unreachable",
        repo,
        branch,
        detail: `couldn't read ${repo}@${branch} (${res.status}${
          data.message ? `: ${data.message}` : ""
        }) — check the token has Contents:read on it`,
      };
    }
    const body = (await res.json()) as { tree?: GitTreeEntry[] };
    tree = body.tree ?? [];
  } catch (err) {
    return {
      ok: false,
      reason: "unreachable",
      repo,
      branch,
      detail: `couldn't reach GitHub (${err instanceof Error ? err.message : "error"}) — try again`,
    };
  }

  const mdFiles = tree.filter((e) => e.type === "blob" && /\.md$/i.test(e.path));
  if (mdFiles.length === 0) {
    return { ok: false, reason: "empty", repo, branch, detail: `no *.md briefs found in ${repo}@${branch}` };
  }

  const slugs: string[] = [];
  for (const file of mdFiles) {
    try {
      const res = await fetch(`${GH}/repos/${repo}/git/blobs/${file.sha}`, { headers, cache: "no-store" });
      if (!res.ok) continue; // skip a file we couldn't read rather than fail the whole pull
      const blob = (await res.json()) as { content?: string; encoding?: string };
      const raw =
        blob.encoding === "base64" && blob.content
          ? Buffer.from(blob.content, "base64").toString("utf8")
          : (blob.content ?? "");
      const name = file.path.split("/").pop() ?? file.path;
      const slug = briefSlug(file.path);
      if (!slug) continue;
      const { title, body } = parseBrief(raw, name);
      await putBriefContent({ slug, title, body, source: file.path });
      slugs.push(slug);
    } catch {
      /* skip a bad file; keep pulling the rest */
    }
  }

  if (slugs.length === 0) {
    return { ok: false, reason: "unreachable", repo, branch, detail: "found briefs but couldn't read any file" };
  }
  return { ok: true, repo, branch, count: slugs.length, slugs };
}
