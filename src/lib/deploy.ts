import { promises as fs } from "fs";
import path from "path";
import { put, get } from "@vercel/blob";
import { verifyEvent } from "nostr-tools";
import { blobStoreEnabled } from "./registry";
import { isOperatorHex } from "./operator-auth";
import { readNodeConfig, writeNodeConfig } from "./nodeconfig";
import { serverBlockInfo } from "./chain-tip-server";

/**
 * SHIP — the signed deploy-to-production action. The admiral used to ship with
 * `npx vercel deploy --prod --yes` in a terminal; SCAR replaces that with one
 * key-signed button. The exact twin of the merge-authorization flow (merges.ts):
 * the client signs a per-action nostr event (content `PACS-DEPLOY-<ts>`, kind
 * 22242) with an allowlisted operator key, the server verifies it against the
 * allowlist + freshness, then fires a Vercel Deploy Hook and records the ship
 * as an audit trail (dual-driver, like tickets/merges). Merge ≠ live — the
 * signature is what turns the current main into production.
 *
 * The hook URL is stored write-only in the same nodeconfig vault as the GitHub
 * token: the admiral connects it once from the GUI (Vercel → Settings → Git →
 * Deploy Hooks for branch `main`), and it's never shown to the browser again —
 * the nodes GET masks it by omission, and the deploy GET returns only a
 * `configured` boolean.
 */

// ── the write-only deploy-hook secret (reuses the nodeconfig store) ──────────

/** A Vercel Deploy Hook is `https://api.vercel.com/v1/integrations/deploy/prj_…/…`.
    Basic sanity so a mistyped/paste-wrong URL never lands in the vault. */
export function isValidDeployHook(url: string): boolean {
  return /^https:\/\/api\.vercel\.com\/.*\/deploy\/.+/.test(url.trim());
}

export async function deployHookConfigured(): Promise<boolean> {
  return !!(await readNodeConfig()).deployHook;
}

/** Store the hook write-only. Returns false if the URL doesn't look like a
    Vercel deploy hook (the route validates too; this is the store's own guard). */
export async function setDeployHook(url: string): Promise<boolean> {
  const trimmed = url.trim();
  if (!isValidDeployHook(trimmed)) return false;
  await writeNodeConfig({ deployHook: trimmed });
  return true;
}

// ── firing the hook ──────────────────────────────────────────────────────────

/** POST the stored deploy hook. A Vercel deploy hook answers with
    `{ job: { id, state, createdAt } }`; we hand that back verbatim so the panel
    can show the job the admiral just started. */
export async function triggerDeploy(): Promise<{ ok: boolean; job?: unknown; reason?: string }> {
  const hook = (await readNodeConfig()).deployHook;
  if (!hook) return { ok: false, reason: "no deploy hook connected" };
  try {
    const res = await fetch(hook, { method: "POST", cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, reason: `Vercel refused the deploy: ${(data as { error?: { message?: string } })?.error?.message ?? res.status}` };
    }
    return { ok: true, job: (data as { job?: unknown }).job ?? data };
  } catch {
    return { ok: false, reason: "couldn't reach Vercel — try again" };
  }
}

// ── the audit log (dual driver, same pattern as merges.ts) ───────────────────

export interface DeployRecord {
  by: string; // operator pubkey hex — the signer
  at: number; // BFT block height at record time (the block IS the record)
  atEstimated?: boolean; // network dark at record time — `at` is a ~estimate, not a block fact
  jobId: string; // Vercel deploy job id (or "" if the hook returned none)
  ts: number; // wall-clock ms, for ordering
}

const LOG_CAP = 20;
const BLOB_PATH = "deploys/log.json";
const filePath = () => path.join(process.cwd(), "data", "deploys.json");

async function readLog(): Promise<DeployRecord[]> {
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

async function writeLog(log: DeployRecord[]): Promise<void> {
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

/** Record one ship, newest kept, capped ~20. `at` is the block height the
    caller read from serverBlockInfo (the route stamps it, like recordDecision);
    `atEstimated` rides along so a network-dark stamp never reads as a block fact. */
export async function recordDeploy({
  by,
  at,
  atEstimated,
  jobId,
}: {
  by: string;
  at: number;
  atEstimated?: boolean;
  jobId: string;
}): Promise<void> {
  const log = await readLog();
  log.push({ by, at, atEstimated, jobId, ts: Date.now() });
  const trimmed = log.slice(-LOG_CAP);
  await writeLog(trimmed);
}

/** The ship log, newest first. */
export async function listDeploys(): Promise<DeployRecord[]> {
  return (await readLog()).slice().reverse();
}

// ── the signed ship authorization ────────────────────────────────────────────

const CHALLENGE_WINDOW_MS = 5 * 60 * 1000;

/** Verify a signed deploy authorization — the same ladder as authorizeMerge:
    shape → content `PACS-DEPLOY-<ts>` → freshness (5 min) → operator allowlist
    → signature. Returns the signer's pubkey or an error; the caller fires the
    hook and records the ship traced to that key. */
export function verifyDeployEvent(event: {
  content?: string;
  pubkey?: string;
  sig?: string;
  kind?: number;
  created_at?: number;
  tags?: unknown;
  id?: string;
}): { ok: true; pubkey: string } | { ok: false; reason: string } {
  if (!event?.content || !event.pubkey || !event.sig) {
    return { ok: false, reason: "signed authorization required" };
  }
  const m = event.content.match(/^PACS-DEPLOY-(\d+)$/);
  if (!m) return { ok: false, reason: "not a deploy authorization" };
  if (Math.abs(Date.now() - Number(m[1])) > CHALLENGE_WINDOW_MS) {
    return { ok: false, reason: "authorization expired — sign a fresh one" };
  }
  if (!isOperatorHex(event.pubkey)) {
    return { ok: false, reason: "that key isn't on this site's operator list" };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!verifyEvent(event as any)) {
    return { ok: false, reason: "signature check failed" };
  }
  return { ok: true, pubkey: event.pubkey };
}

/** Convenience for the route: verify → fire → record, all traced to the signer.
    Reads the current block height itself so the audit stamp is honest. */
export async function authorizeDeploy(event: Parameters<typeof verifyDeployEvent>[0]): Promise<
  | { ok: true; job?: unknown; note: string }
  | { ok: false; reason: string }
> {
  const verified = verifyDeployEvent(event);
  if (!verified.ok) return verified;

  const fired = await triggerDeploy();
  if (!fired.ok) return { ok: false, reason: fired.reason ?? "deploy failed" };

  const jobId = (fired.job as { id?: string })?.id ?? "";
  /* the REAL block, own node first (serverBlockInfo) — an unreachable network
     records the estimate FLAGGED, never as a bare block fact */
  const { height, estimated } = await serverBlockInfo();
  await recordDeploy({
    by: verified.pubkey,
    at: height,
    atEstimated: estimated || undefined,
    jobId,
  });
  return { ok: true, job: fired.job, note: "deploy triggered ✓" };
}
