import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { readArtistRoster, writeArtistRoster } from "@/lib/artist";

export const dynamic = "force-dynamic";

/**
 * The artist roster — the operator-configurable allowlist behind the artist
 * training gate. Operator-gated, GUI-first like the node links: the stored
 * roster wins, ARTIST_NPUBS env stays as the bootstrap fallback (reported
 * here so the console can show what a fresh fork inherits).
 */
export async function GET(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  const roster = await readArtistRoster();
  const envFallback = (process.env.ARTIST_NPUBS ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  return Response.json({ ok: true, roster, envFallback });
}

export async function PUT(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  let body: { npubs?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }
  if (!Array.isArray(body.npubs) || body.npubs.some((n) => typeof n !== "string")) {
    return Response.json({ ok: false, reason: "npubs must be an array of strings" }, { status: 400 });
  }
  const result = await writeArtistRoster(body.npubs as string[]);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
