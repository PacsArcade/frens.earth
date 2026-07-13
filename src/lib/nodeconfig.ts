import { promises as fs } from "fs";
import path from "path";
import { put, get } from "@vercel/blob";
import { blobStoreEnabled } from "./registry";

/**
 * Node links, operator-editable — the admiral connects their own servers from
 * the GUI (Pac, 2026-07-11), not by editing deployment env. Stored config
 * wins; env vars remain the bootstrap fallback so a fresh fork still works
 * from .env alone. Dual-driver like tickets/merges.
 *
 * `ceremony` rides here too: what a batch ceremony SENDS (certificate
 * template + the welcome letter) is configurable per POKE node standup.
 * Sparks parked: the ceremony doubles as the newsletter welcome letter, and
 * gets posted to the @frens nostr profile with hashtags.
 */

export interface CeremonyConfig {
  certTemplate: string; // which keepsake goes out — per-node choice
  welcomeMessage: string; // the welcome letter (newsletter + nostr, later)
}

export interface NodeConfig {
  spacesUrl: string;
  spacesToken: string;
  mudUrl: string;
  mudToken: string;
  /** The chat floor — an orbee (nostr NIP-29 group chat) door. No token:
      orbee needs no write, the floor resolves tags live. Unset falls through
      env to the house floor at chat.frens.earth. */
  chatUrl: string;
  /** GitHub link for the SCAR merge queue — paste-in from the GUI, so the
      admiral never has to touch deployment env (Pac, 2026-07-11). */
  githubToken: string;
  githubRepo: string;
  /** The PRIVATE briefs repo the library pulls from (captains-only) — the
      "personal" tier. Not a secret (just owner/name + branch) — the SAME
      githubToken above reads it (needs Contents:read on it). The brief CONTENT
      never lands in this public repo; the pull writes it straight into the
      dual-driver briefs store. */
  briefsRepo: string;
  briefsBranch: string;
  /** The PERSONAL briefs token — a DEDICATED, briefs-scoped key with its own
      place to enter it (the admiral kept hunting for one). Write-only: set via
      the nodes PUT, masked-by-omission from the GET, like githubToken/deployHook.
      The personal pull PREFERS this; if unset it falls back to the shared
      merge-queue githubToken, so nothing breaks for anyone already on that. Its
      own 90-day renewal, independent of the merge token. Fine-grained PAT with
      Contents:read on the briefs repo. */
  briefsToken: string;
  /** The SHARED (public) briefs repo — the "shared" tier. Pulled via the public
      GitHub API with NO token (captains need no key for these). Just owner/name
      + branch. Honest empty/not-found state until this repo exists. The content
      still lands only in the gitignored/blob store, never in this public repo. */
  sharedBriefsRepo: string;
  sharedBriefsBranch: string;
  /** Chain-data node — the mempool.space REST API the fleet reads block tip +
      mempool fill from. Sovereignty fix (the admiral, 2026-07-11): don't
      hardcode a third party. Point this at Pac's Arcade's OWN self-hosted
      mempool instance; unset falls through env to the public mempool.space so
      a fresh fork still ticks. No token — read-only public chain data. */
  mempoolUrl: string;
  /** Vercel Deploy Hook URL for shipping main → production from SCAR. Stored
      write-only (masked by omission from the nodes GET, like the GitHub token);
      the admiral pastes it once and ships by signature after. See deploy.ts. */
  deployHook: string;
  ceremony: CeremonyConfig;
}

const EMPTY: NodeConfig = {
  spacesUrl: "",
  spacesToken: "",
  mudUrl: "",
  mudToken: "",
  chatUrl: "",
  githubToken: "",
  githubRepo: "",
  briefsRepo: "",
  briefsBranch: "",
  briefsToken: "",
  sharedBriefsRepo: "",
  sharedBriefsBranch: "",
  mempoolUrl: "",
  deployHook: "",
  ceremony: { certTemplate: "bft-auto", welcomeMessage: "" },
};

/** The house floor — where the chat door opens when nothing is pointed.
    Mirrors the arcade: chat.pacsarcade.org is orbee's door there, chat.frens.earth here. */
export const CHAT_URL_DEFAULT = "https://chat.frens.earth";

/** The public fallback for chain data — the fleet still ticks on a fresh fork
    that hasn't stood up its own node. The whole point of mempoolUrl is to stop
    phoning this third party; it's the floor, not the goal. */
export const MEMPOOL_URL_DEFAULT = "https://mempool.space";

const BLOB_PATH = "config/nodes.json";
const filePath = () => path.join(process.cwd(), "data", "nodes.json");

export async function readNodeConfig(): Promise<NodeConfig> {
  let stored: Partial<NodeConfig> = {};
  if (blobStoreEnabled()) {
    try {
      const res = await get(BLOB_PATH, { access: "public" });
      if (res && res.statusCode === 200) stored = JSON.parse(await new Response(res.stream).text());
    } catch {
      /* unconfigured */
    }
  } else {
    try {
      stored = JSON.parse(await fs.readFile(filePath(), "utf8"));
    } catch {
      /* unconfigured */
    }
  }
  return {
    ...EMPTY,
    ...stored,
    ceremony: { ...EMPTY.ceremony, ...(stored.ceremony ?? {}) },
  };
}

export async function writeNodeConfig(patch: Partial<NodeConfig>): Promise<NodeConfig> {
  const current = await readNodeConfig();
  const next: NodeConfig = {
    ...current,
    ...patch,
    ceremony: { ...current.ceremony, ...(patch.ceremony ?? {}) },
  };
  const body = JSON.stringify(next, null, 2);
  if (blobStoreEnabled()) {
    await put(BLOB_PATH, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
  } else {
    const p = filePath();
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, body, "utf8");
  }
  return next;
}

/** Effective endpoints: stored config first, env bootstrap second. */
export async function effectiveSpacesNode(): Promise<{ url: string; token: string }> {
  const c = await readNodeConfig();
  return {
    url: c.spacesUrl || process.env.SPACES_NODE_URL?.trim() || "",
    token: c.spacesToken || process.env.SPACES_NODE_TOKEN?.trim() || "",
  };
}

export async function effectiveMudNode(): Promise<{ url: string; token: string }> {
  const c = await readNodeConfig();
  return {
    url: c.mudUrl || process.env.MUD_NODE_URL?.trim() || "",
    token: c.mudToken || process.env.MUD_ADMIN_TOKEN?.trim() || "",
  };
}

/** The chat door, with its provenance — stored config first, env bootstrap
    second, the house floor last (the one node link with a default: a fresh
    fork's chat door still opens somewhere honest). */
export async function effectiveChatNode(): Promise<{
  url: string;
  source: "stored" | "env" | "default";
}> {
  const c = await readNodeConfig();
  if (c.chatUrl) return { url: c.chatUrl, source: "stored" };
  const env = process.env.CHAT_NODE_URL?.trim();
  if (env) return { url: env, source: "env" };
  return { url: CHAT_URL_DEFAULT, source: "default" };
}

/** The chain-data node, with its provenance — stored config first, env
    bootstrap (MEMPOOL_NODE_URL) second, the public mempool.space last. Like the
    chat door, this one carries a default so a fresh fork still reads the tip;
    `source: "default"` is the honest tell that the fleet is phoning a third
    party and the admiral hasn't pointed their own node yet. */
export async function effectiveMempoolNode(): Promise<{
  url: string;
  source: "stored" | "env" | "default";
}> {
  const c = await readNodeConfig();
  if (c.mempoolUrl) return { url: c.mempoolUrl, source: "stored" };
  const env = process.env.MEMPOOL_NODE_URL?.trim();
  if (env) return { url: env, source: "env" };
  return { url: MEMPOOL_URL_DEFAULT, source: "default" };
}

export async function effectiveGithub(): Promise<{ repo: string; token: string }> {
  const c = await readNodeConfig();
  return {
    repo: c.githubRepo || process.env.GITHUB_REPO?.trim() || "PacsArcade/frens.earth",
    token: c.githubToken || process.env.GITHUB_TOKEN?.trim() || "",
  };
}

/** The private briefs repo the library pulls from — stored config first, env
    bootstrap second, the house default last. This only names WHERE to read; the
    token comes from effectiveBriefsToken(). A fresh fork points it at its own
    captains-only repo. */
export async function effectiveBriefsRepo(): Promise<{ repo: string; branch: string }> {
  const c = await readNodeConfig();
  return {
    repo: c.briefsRepo || process.env.BRIEFS_REPO?.trim() || "PacsArcade/frens-briefs",
    branch: c.briefsBranch || process.env.BRIEFS_BRANCH?.trim() || "main",
  };
}

/** The token the PERSONAL briefs pull authenticates with. PREFERS the dedicated
    briefs token (stored config first, env bootstrap second) so there's an
    obvious, briefs-scoped place to enter a key with its own 90-day renewal; if
    that's unset it FALLS BACK to the shared merge-queue GitHub PAT, so nothing
    breaks for anyone already pulling on the shared token. `source` tells which
    key answered (or `none` when neither is connected). */
export async function effectiveBriefsToken(): Promise<{
  token: string;
  source: "briefs" | "github" | "none";
}> {
  const c = await readNodeConfig();
  const briefs = c.briefsToken || process.env.BRIEFS_TOKEN?.trim() || "";
  if (briefs) return { token: briefs, source: "briefs" };
  const github = c.githubToken || process.env.GITHUB_TOKEN?.trim() || "";
  if (github) return { token: github, source: "github" };
  return { token: "", source: "none" };
}

/** The SHARED (public) briefs repo the library pulls from — stored config
    first, env bootstrap second, the house default last. Pulled with NO token
    (public read), so a captain needs no key for these. A fresh fork points it
    at its own public briefs repo; unset falls through to frens-briefs-public. */
export async function effectiveSharedBriefsRepo(): Promise<{ repo: string; branch: string }> {
  const c = await readNodeConfig();
  return {
    repo: c.sharedBriefsRepo || process.env.SHARED_BRIEFS_REPO?.trim() || "PacsArcade/frens-briefs-public",
    branch: c.sharedBriefsBranch || process.env.SHARED_BRIEFS_BRANCH?.trim() || "main",
  };
}
