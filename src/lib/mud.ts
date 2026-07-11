/**
 * MUD node client — the frens.earth backend's link to THIS deployment's own
 * P.O.K.E. MUD node (knowledge-engine). Like the `spaced` node, the MUD runs
 * as a companion daemon (its admin API on :4001); the app only points at it,
 * tests the link, and reads status — the heavy engine + LLM hookups stay on
 * the node. Config: MUD_NODE_URL + MUD_ADMIN_TOKEN (sent as the MUD's
 * X-POKE-Admin-Token). Each admiral points at their own node; nothing here is
 * host-specific, and the app never runs the game itself.
 */

import { effectiveMudNode } from "./nodeconfig";

const TIMEOUT_MS = 6000;

export async function mudConfigured(): Promise<boolean> {
  return (await effectiveMudNode()).url.length > 0;
}
export async function mudHasToken(): Promise<boolean> {
  return (await effectiveMudNode()).token.length > 0;
}

export class MudNodeError extends Error {}

async function mudGet<T = unknown>(path: string, withToken: boolean): Promise<T> {
  const { url: base, token } = await effectiveMudNode();
  if (!base) throw new MudNodeError("no MUD node configured — set it on /a/mud");
  const url = base.replace(/\/$/, "") + path;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: withToken && token ? { "X-POKE-Admin-Token": token } : {},
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    throw new MudNodeError(`node unreachable: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (res.status === 401 || res.status === 403) throw new MudNodeError("admin token rejected");
  if (!res.ok) throw new MudNodeError(`node returned HTTP ${res.status}`);
  try {
    return (await res.json()) as T;
  } catch {
    throw new MudNodeError("node returned a non-JSON response");
  }
}

/** Public config — proves the node is reachable (no token needed). */
export function getMudConfig(): Promise<Record<string, unknown>> {
  return mudGet("/config", false);
}

/** A token-gated endpoint — proves the admin token is accepted. */
export function getMudStats(): Promise<Record<string, unknown>> {
  return mudGet("/stats", true);
}
