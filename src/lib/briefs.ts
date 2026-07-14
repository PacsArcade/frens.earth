import { promises as fs } from "fs";
import path from "path";
import { put, get, list } from "@vercel/blob";
import { verifyEvent } from "nostr-tools";
import { blobStoreEnabled } from "./registry";
import { isOperatorHex } from "./operator-auth";
import { effectiveBriefsToken, effectiveBriefsRepo, effectiveSharedBriefsRepo } from "./nodeconfig";
import { serverBlockInfo } from "./chain-tip-server";

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
 * ── TWO TIERS ────────────────────────────────────────────────────────────────
 * Every brief carries a `tier`:
 *   • PERSONAL — PULLED from a private, captains-only GitHub repo (briefsRepo in
 *     the node config, default PacsArcade/frens-briefs) using the DEDICATED
 *     briefs token if set (its own briefs-scoped key, its own renewal), else the
 *     merge queue's connected PAT — a fine-grained token needing Contents:read on
 *     that repo either way.
 *   • SHARED — PULLED from a PUBLIC GitHub repo (sharedBriefsRepo, default
 *     PacsArcade/frens-briefs-public) via the public API with NO token, so
 *     captains need no key for these. Honest empty/not-found state until it
 *     exists.
 * The two tiers live in separate store prefixes so their slugs never collide.
 * `scripts/sync-briefs.mjs` is a secondary dev convenience that writes the
 * personal tier from a local sibling folder. Content flows repo → store, NEVER
 * into this public repo — for EITHER tier.
 *
 * ── REVIEWS ─────────────────────────────────────────────────────────────────
 * Each brief carries at most one review record — a sign-off or a send-back,
 * BFT-stamped, and bound to a per-action operator signature
 * (`PACS-BRIEF-<slug>-<ts>-<signoff|sendback>`), the console's signed-action
 * model. Reviews store per-item (one blob per slug in prod, one JSON file in
 * dev) so they never clobber each other — the same fix decisions' rulings use.
 * Writes are operator-gated in the API route AND signature-verified here.
 */

/** SHARED = the public source (frens-briefs-public); PERSONAL = the private
    captains-only source (frens-briefs). Stored per brief; the store PREFIX a
    brief lives under is authoritative for its tier. */
export type BriefTier = "shared" | "personal";

export interface BriefContent {
  slug: string;
  title: string;
  body: string; // markdown
  source?: string; // where it came from (filename / repo path)
  tier: BriefTier; // which source this came from
}

export type BriefStatus = "unreviewed" | "revise" | "signed";

export interface BriefReview {
  slug: string;
  tier: BriefTier; // the tier its brief lives in — reviews key on (tier, slug)
  status: "signed" | "revise"; // signed off, or sent back for another pass
  comment?: string;
  at: number; // block height at record — the block IS the record
  /** the network was dark at record time — `at` is a genesis ~estimate, never
      a block fact; the UI wears the honest `~ ` */
  atEstimated?: boolean;
  by?: string; // operator pubkey hex
  sig?: string; // the per-action signature — the record IS the proof
}

/** A brief joined with its latest review — the shape the UI reads. */
export interface Brief extends BriefContent {
  status: BriefStatus;
  comment?: string;
  at?: number;
  atEstimated?: boolean;
  by?: string;
  sig?: string;
}

// ── storage paths (tier-namespaced) ─────────────────────────────────────────
// Content: one doc per brief. Reviews: one record per brief (never a shared
// doc — see the decisions store for why eventually-consistent blob reads make a
// read-modify-write of a shared doc clobber concurrent writes). PERSONAL keeps
// v1's flat paths (zero migration); SHARED lives under its own prefix, so a
// same-named brief in both tiers never overwrites the other.
const CONTENT_BLOB_DIR: Record<BriefTier, string> = {
  personal: "briefs/content/",
  shared: "briefs/shared/",
};
const REVIEW_BLOB_DIR: Record<BriefTier, string> = {
  personal: "briefs/reviews/",
  shared: "briefs/shared-reviews/",
};
const contentBlobPath = (tier: BriefTier, slug: string) => `${CONTENT_BLOB_DIR[tier]}${slug}.json`;
const reviewBlobPath = (tier: BriefTier, slug: string) => `${REVIEW_BLOB_DIR[tier]}${slug}.json`;

/** Local dev store — GITIGNORED (see .gitignore). Content is one file per brief
    under data/briefs/ (personal) or data/briefs-shared/ (shared); reviews are a
    single JSON per tier (one dev process → no clobber). */
function contentDir(tier: BriefTier): string {
  return path.join(process.cwd(), "data", tier === "shared" ? "briefs-shared" : "briefs");
}
function contentFilePath(tier: BriefTier, slug: string): string {
  return path.join(contentDir(tier), `${slug}.json`);
}
function reviewsFilePath(tier: BriefTier): string {
  return path.join(process.cwd(), "data", tier === "shared" ? "brief-reviews-shared.json" : "brief-reviews.json");
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

// ── content store (dual driver, tier-namespaced) ────────────────────────────

/** Every brief in ONE tier's store. The store prefix is authoritative for the
    tier, so we stamp it on read (a legacy v1 doc with no `tier` field still
    classifies correctly by where it lives). */
async function listContentsForTier(tier: BriefTier): Promise<BriefContent[]> {
  if (blobStoreEnabled()) {
    const out: BriefContent[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: CONTENT_BLOB_DIR[tier], cursor });
      const texts = await Promise.all(page.blobs.map((b) => readBlobText(b.pathname)));
      for (const t of texts) {
        if (!t) continue;
        try {
          const c = JSON.parse(t) as BriefContent;
          if (c?.slug) out.push({ ...c, tier });
        } catch {
          /* skip a malformed doc rather than break the library */
        }
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out;
  }
  try {
    const dir = contentDir(tier);
    const files = await fs.readdir(dir);
    const out: BriefContent[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const c = JSON.parse(await fs.readFile(path.join(dir, f), "utf8")) as BriefContent;
        if (c?.slug) out.push({ ...c, tier });
      } catch {
        /* skip a malformed doc */
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Both tiers, merged — shared + personal. */
export async function listBriefContents(): Promise<BriefContent[]> {
  const [personal, shared] = await Promise.all([
    listContentsForTier("personal"),
    listContentsForTier("shared"),
  ]);
  return [...personal, ...shared];
}

export async function getBriefContent(tier: BriefTier, slug: string): Promise<BriefContent | null> {
  if (blobStoreEnabled()) {
    const t = await readBlobText(contentBlobPath(tier, slug));
    if (!t) return null;
    try {
      return { ...(JSON.parse(t) as BriefContent), tier };
    } catch {
      return null;
    }
  }
  try {
    return { ...(JSON.parse(await fs.readFile(contentFilePath(tier, slug), "utf8")) as BriefContent), tier };
  } catch {
    return null;
  }
}

/** Write one brief into its tier's store — used by the repo pullers and the dev
    sync script's blob path. The content lands in Blob (prod) or the gitignored
    data/briefs[-shared]/ dir (dev); it is NEVER committed to this public repo. */
export async function putBriefContent(brief: BriefContent): Promise<void> {
  const body = JSON.stringify(brief, null, 2);
  if (blobStoreEnabled()) {
    await put(contentBlobPath(brief.tier, brief.slug), body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }
  const p = contentFilePath(brief.tier, brief.slug);
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = p + ".tmp";
  await fs.writeFile(tmp, body, "utf8");
  await fs.rename(tmp, p);
}

// ── review store (dual driver, per-item, tier-namespaced) ───────────────────

async function readReviewsForTier(tier: BriefTier): Promise<BriefReview[]> {
  if (blobStoreEnabled()) {
    const bySlug = new Map<string, BriefReview>();
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: REVIEW_BLOB_DIR[tier], cursor });
      const texts = await Promise.all(page.blobs.map((b) => readBlobText(b.pathname)));
      for (const t of texts) {
        if (!t) continue;
        try {
          const r = JSON.parse(t) as BriefReview;
          if (r?.slug) bySlug.set(r.slug, { ...r, tier });
        } catch {
          /* skip a malformed review */
        }
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return [...bySlug.values()];
  }
  try {
    const reviews =
      (JSON.parse(await fs.readFile(reviewsFilePath(tier), "utf8")) as { reviews: BriefReview[] }).reviews ?? [];
    return reviews.map((r) => ({ ...r, tier }));
  } catch {
    return [];
  }
}

/** Every review, both tiers. */
async function readReviews(): Promise<BriefReview[]> {
  const [personal, shared] = await Promise.all([
    readReviewsForTier("personal"),
    readReviewsForTier("shared"),
  ]);
  return [...personal, ...shared];
}

async function writeReview(review: BriefReview): Promise<void> {
  if (blobStoreEnabled()) {
    await put(reviewBlobPath(review.tier, review.slug), JSON.stringify(review), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }
  // dev only — single process, so a plain file read-modify-write is safe
  const p = reviewsFilePath(review.tier);
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
    atEstimated: review.atEstimated,
    by: review.by,
    sig: review.sig,
  };
}

/** Every brief with its review status merged on top. Reviews key on
    (tier, slug) so a same-named brief in both tiers never crosses wires. Order:
    unreviewed first (needs the admiral), then sent-back (awaiting rework), then
    signed — the latter two newest-block first, unreviewed alphabetical. */
export async function listBriefs(): Promise<Brief[]> {
  const [contents, reviews] = await Promise.all([listBriefContents(), readReviews()]);
  const key = (tier: BriefTier, slug: string) => `${tier}/${slug}`;
  const byKey = new Map(reviews.map((r) => [key(r.tier, r.slug), r]));
  const merged = contents.map((c) => join(c, byKey.get(key(c.tier, c.slug))));
  const rank = { unreviewed: 0, revise: 1, signed: 2 } as const;
  return merged.sort((a, b) => {
    if (a.status !== b.status) return rank[a.status] - rank[b.status];
    if (a.status === "unreviewed") return a.title.localeCompare(b.title);
    return (b.at ?? 0) - (a.at ?? 0);
  });
}

export async function getBrief(tier: BriefTier, slug: string): Promise<Brief | null> {
  const content = await getBriefContent(tier, slug);
  if (!content) return null;
  const review = (await readReviewsForTier(tier)).find((r) => r.slug === slug);
  return join(content, review);
}

// ── recording a signed review ───────────────────────────────────────────────

const CHALLENGE_WINDOW_MS = 5 * 60 * 1000;
/* content: `PACS-BRIEF-<tier>-<slug>-<unix-ms>-<signoff|sendback>` + optional
   `\n<comment>`. Tier is pinned to the FRONT (fixed alternation) and the action
   to the END, so the slug's own hyphens and internal digits stay unambiguous
   (greedy slug between `-<tier>-` and `-<digits>-<action>`). */
const BRIEF_ACTION_RE =
  /^PACS-BRIEF-(shared|personal)-(.+)-(\d+)-(signoff|sendback)(?:\n([\s\S]*))?$/;

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
  const [, tier, slug, ts, action, rawComment] = m as unknown as [
    string,
    BriefTier,
    string,
    string,
    "signoff" | "sendback",
    string | undefined,
  ];
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

  const content = await getBriefContent(tier, slug);
  if (!content) return { ok: false, reason: "no such brief in the library" };

  const comment = (rawComment ?? "").trim().slice(0, 4000) || undefined;
  if (action === "sendback" && !comment) {
    return { ok: false, reason: "a send-back needs a comment — say what to change" };
  }

  /* the REAL block, own node first (serverBlockInfo) — an unreachable network
     records the estimate FLAGGED, never as a bare block fact */
  const { height, estimated } = await serverBlockInfo();
  const review: BriefReview = {
    slug,
    tier,
    status: action === "sendback" ? "revise" : "signed",
    comment,
    at: height,
    atEstimated: estimated || undefined,
    by: event.pubkey,
    sig: event.sig,
  };
  await writeReview(review);
  return { ok: true, brief: join(content, review) };
}

// ── the pulls: shared (public, no token) + personal (private, token) ─────────

const GH = "https://api.github.com";

export interface PullResult {
  ok: boolean;
  tier: BriefTier;
  /** honest state when it can't run — mirrors the merge queue's connect box.
      `not-found` = the repo/branch 404s (e.g. the public repo isn't made yet). */
  reason?: "connect-github" | "unreachable" | "empty" | "not-found";
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
 * The shared pull-engine for one tier: read the repo's recursive tree, fetch
 * each `*.md` blob, parse it, and write it into THIS tier's store via
 * putBriefContent — content flows repo → store, NEVER into this public repo.
 * Auth is the ONLY difference between tiers: personal sends the operator's PAT,
 * shared sends none (public read). Returns an honest `reason` on every failure.
 */
async function pullTier(
  tier: BriefTier,
  repo: string,
  branch: string,
  token: string | null,
): Promise<PullResult> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "frens-earth-scar",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let tree: GitTreeEntry[];
  try {
    const res = await fetch(`${GH}/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      // a 404 on a public pull almost always means the repo/branch isn't there
      // yet — an honest "not made yet" state, not a wiring error.
      const notFound = res.status === 404;
      return {
        ok: false,
        tier,
        reason: notFound ? "not-found" : "unreachable",
        repo,
        branch,
        detail: notFound
          ? tier === "shared"
            ? `no public briefs repo at ${repo}@${branch} yet — make it (or point elsewhere in Connections)`
            : `couldn't find ${repo}@${branch} (404) — check the repo, branch, and token access`
          : `couldn't read ${repo}@${branch} (${res.status}${data.message ? `: ${data.message}` : ""})${
              tier === "personal" ? " — check the token has Contents:read on it" : ""
            }`,
      };
    }
    const body = (await res.json()) as { tree?: GitTreeEntry[] };
    tree = body.tree ?? [];
  } catch (err) {
    return {
      ok: false,
      tier,
      reason: "unreachable",
      repo,
      branch,
      detail: `couldn't reach GitHub (${err instanceof Error ? err.message : "error"}) — try again`,
    };
  }

  const mdFiles = tree.filter((e) => e.type === "blob" && /\.md$/i.test(e.path));
  if (mdFiles.length === 0) {
    return { ok: false, tier, reason: "empty", repo, branch, detail: `no *.md briefs found in ${repo}@${branch}` };
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
      await putBriefContent({ slug, title, body, source: file.path, tier });
      slugs.push(slug);
    } catch {
      /* skip a bad file; keep pulling the rest */
    }
  }

  if (slugs.length === 0) {
    return { ok: false, tier, reason: "unreachable", repo, branch, detail: "found briefs but couldn't read any file" };
  }
  return { ok: true, tier, repo, branch, count: slugs.length, slugs };
}

/** The PERSONAL tier — the private captains-only repo. Reads with the DEDICATED
    briefs token if one is set (its own briefs-scoped key), else falls back to the
    console's connected merge-queue PAT (Contents:read either way). Honest
    `connect-github` when NEITHER is connected. */
export async function pullPersonalBriefs(): Promise<PullResult> {
  const [{ token }, { repo, branch }] = await Promise.all([effectiveBriefsToken(), effectiveBriefsRepo()]);
  if (!token) {
    return {
      ok: false,
      tier: "personal",
      reason: "connect-github",
      repo,
      branch,
      detail:
        "no briefs token connected — paste a dedicated briefs token in Connections → Briefs, or connect the merge-queue PAT (needs Contents:read on the briefs repo)",
    };
  }
  return pullTier("personal", repo, branch, token);
}

/** The SHARED tier — the PUBLIC repo, read with NO token (public API). Honest
    `not-found` until that repo exists. Captains need no key for these. */
export async function pullSharedBriefs(): Promise<PullResult> {
  const { repo, branch } = await effectiveSharedBriefsRepo();
  return pullTier("shared", repo, branch, null);
}

/** Pull BOTH sources — shared (no token) + personal (token) — each with its own
    honest status. One button, two independent results; the overall `ok` is true
    if EITHER source landed briefs, so a missing public repo never masks a good
    personal pull (and vice-versa). */
export async function pullAllBriefs(): Promise<{
  ok: boolean;
  shared: PullResult;
  personal: PullResult;
  count: number;
}> {
  const [shared, personal] = await Promise.all([pullSharedBriefs(), pullPersonalBriefs()]);
  const count = (shared.count ?? 0) + (personal.count ?? 0);
  return { ok: shared.ok || personal.ok, shared, personal, count };
}
