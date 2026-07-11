import { effectiveSpacesNode } from "./nodeconfig";

/**
 * Spaces node client — the frens.earth backend's link to THIS deployment's own
 * `spaced` node (each space runs its own; see docs/spaces-anchoring.md). All
 * on-chain work — owning @<space>, committing a subspace batch — lives on the
 * node with its wallet; this app only speaks to the node's JSON-RPC and never
 * holds a key.
 *
 * The endpoint is operator-editable from /a/spaces (stored config via
 * nodeconfig.ts); SPACES_NODE_URL/SPACES_NODE_TOKEN env stay as the bootstrap
 * fallback. `spaced` is localhost-only with no built-in auth — a remote
 * deployment reaches it through an authenticating proxy (token → Bearer).
 */

const RPC_TIMEOUT_MS = 8000;

/** True when a node endpoint is configured (stored config or env). */
export async function spacesConfigured(): Promise<boolean> {
  return (await effectiveSpacesNode()).url.length > 0;
}

export class SpacesNodeError extends Error {}

/** One JSON-RPC 2.0 call to the node. Throws SpacesNodeError on any failure so
    callers can distinguish "node down" from a real result. */
export async function spacesRpc<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
  const { url, token } = await effectiveSpacesNode();
  if (!url) throw new SpacesNodeError("no node configured — set it on /a/spaces");
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    throw new SpacesNodeError(
      `node unreachable: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (!res.ok) throw new SpacesNodeError(`node returned HTTP ${res.status}`);
  let body: { result?: T; error?: { message?: string } };
  try {
    body = await res.json();
  } catch {
    throw new SpacesNodeError("node returned a non-JSON response");
  }
  if (body.error) throw new SpacesNodeError(body.error.message ?? "rpc error");
  return body.result as T;
}

/** Server status + chain tip — the connection test and the "look at the block"
    view. Shape kept loose until confirmed against a running node. */
export interface ServerInfo {
  chain?: string;
  tip?: { height?: number; hash?: string };
  [k: string]: unknown;
}
export function getServerInfo(): Promise<ServerInfo> {
  return spacesRpc<ServerInfo>("getserverinfo");
}

/** The outpoint owning a space — used to confirm the node's wallet actually
    owns @<space> before it can issue subspaces under it. `spaced` expects the
    @-prefixed name. A null-ish result means unregistered/unowned. */
export function getSpaceOwner(space: string): Promise<unknown> {
  return spacesRpc("getspaceowner", [space.startsWith("@") ? space : `@${space}`]);
}
