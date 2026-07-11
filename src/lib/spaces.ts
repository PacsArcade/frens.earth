/**
 * Spaces node client — the frens.earth backend's link to THIS deployment's own
 * `spaced` node (each space runs its own; see docs/spaces-anchoring.md). All
 * on-chain work — owning @<space>, committing a subspace batch — lives on the
 * node with its wallet; this app only speaks to the node's JSON-RPC and never
 * holds a key.
 *
 * `spaced` serves JSON-RPC 2.0 (default http://127.0.0.1:7225) and is
 * localhost-only with no built-in auth. A remote/serverless deployment must
 * therefore reach it through an authenticating proxy: point SPACES_NODE_URL at
 * that proxy and set SPACES_NODE_TOKEN to send a Bearer header. Nothing here is
 * host-specific — the operator configures their own node in the admin area.
 */

const NODE_URL = process.env.SPACES_NODE_URL?.trim() ?? "";
const NODE_TOKEN = process.env.SPACES_NODE_TOKEN?.trim() ?? "";
const RPC_TIMEOUT_MS = 8000;

/** True when a node endpoint is configured for this deployment. */
export function spacesConfigured(): boolean {
  return NODE_URL.length > 0;
}

export class SpacesNodeError extends Error {}

/** One JSON-RPC 2.0 call to the node. Throws SpacesNodeError on any failure so
    callers can distinguish "node down" from a real result. */
export async function spacesRpc<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
  if (!NODE_URL) throw new SpacesNodeError("SPACES_NODE_URL not configured");
  let res: Response;
  try {
    res = await fetch(NODE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(NODE_TOKEN ? { Authorization: `Bearer ${NODE_TOKEN}` } : {}),
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
