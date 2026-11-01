import { createHash, timingSafeEqual } from "crypto";
import { releaseSubname, seatReservedHandle, checkSubnameFormat } from "./registry";
import { SPACE_NAME } from "./identity-config";

/**
 * Server-to-server door for a parent app (today: vend) to seat and release
 * sub-names under its own parent only. Auth is a shared secret header checked
 * in constant time against FRENS_SUBNAME_SECRET_<PARENT>. If that env is not
 * set the door answers 503 and does nothing. The secret is never logged or
 * echoed. Every failure says why, with an honest status.
 */

export const SUBNAME_SECRET_HEADER = "x-frens-subname-secret";

/** parent -> env name holding its shared secret */
const SECRET_ENV: Record<string, string> = { vend: "FRENS_SUBNAME_SECRET_VEND" };

/* Simple per-instance rate limit: 20 calls per minute per parent. Serverless
   instances each keep their own count, so this is a brake, not a hard wall. */
const WINDOW_MS = 60_000;
const MAX_CALLS = 20;
const hits = new Map<string, number[]>();

export function resetSubnameRateLimit(): void {
  hits.clear();
}

function rateLimited(parent: string): boolean {
  const now = Date.now();
  const recent = (hits.get(parent) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_CALLS) {
    hits.set(parent, recent);
    return true;
  }
  recent.push(now);
  hits.set(parent, recent);
  return false;
}

function secretsMatch(given: string, expected: string): boolean {
  // hash both so the compare is constant time whatever the lengths
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function fail(status: number, reason: string): Response {
  return Response.json({ ok: false, reason }, { status });
}

/** method is "seat" (POST) or "release" (DELETE). Body: { parent, name, npub? } */
export async function handleSubnameRequest(
  request: Request,
  method: "seat" | "release",
  opts: { blockHeight?: number | null } = {}
): Promise<Response> {
  let body: { parent?: unknown; name?: unknown; npub?: unknown; space?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid request");
  }
  if (typeof body.parent !== "string" || typeof body.name !== "string") {
    return fail(400, "parent and name required");
  }
  const parent = body.parent.trim().toLowerCase();
  const envName = SECRET_ENV[parent];
  if (!envName) return fail(400, "that parent name does not take sub-names");

  const expected = process.env[envName];
  if (!expected) return fail(503, "not configured");

  const given = request.headers.get(SUBNAME_SECRET_HEADER) ?? "";
  if (!given || !secretsMatch(given, expected)) {
    return fail(401, "bad or missing secret");
  }
  if (rateLimited(parent)) return fail(429, "slow down, too many calls");

  const full = checkSubnameFormat(`${body.name}.${parent}`);
  if (!full.ok) return fail(400, full.reason);
  // the name itself must not carry a dot of its own (no a.b.vend)
  if (String(body.name).includes(".")) return fail(400, "one level only: name.parent");

  const space = typeof body.space === "string" ? body.space : SPACE_NAME;

  if (method === "release") {
    const result = await releaseSubname(full.name, parent, space);
    if (!result.ok) {
      const status = result.reason.includes("hiccuped") ? 503 : 409;
      return fail(status, result.reason);
    }
    return Response.json({ ok: true });
  }

  if (typeof body.npub !== "string") return fail(400, "npub required");
  const result = await seatReservedHandle({
    handle: full.handle,
    npub: body.npub,
    space,
    blockHeight: opts.blockHeight ?? null,
  });
  if (!result.ok) {
    const status =
      result.reason === "already claimed"
        ? 409
        : result.reason.includes("hiccuped")
          ? 503
          : 400;
    return fail(status, result.reason);
  }
  return Response.json({ ok: true, entry: result.entry });
}
