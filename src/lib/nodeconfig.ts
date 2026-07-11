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
  ceremony: CeremonyConfig;
}

const EMPTY: NodeConfig = {
  spacesUrl: "",
  spacesToken: "",
  mudUrl: "",
  mudToken: "",
  ceremony: { certTemplate: "bft-auto", welcomeMessage: "" },
};

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
