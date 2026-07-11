import { artistFromRequest, spaceNameStatus } from "@/lib/artist";

export const dynamic = "force-dynamic";

/**
 * One name's on-chain life — the request form's availability check and the
 * watchlist's CHECK button. Artist-gated. When the node can't answer, says
 * so plainly instead of guessing.
 */
export async function GET(request: Request) {
  const gate = await artistFromRequest(request);
  if (!gate.ok) {
    return Response.json({ ok: false, reason: gate.reason }, { status: gate.status });
  }
  const name = new URL(request.url).searchParams.get("name") ?? "";
  const result = await spaceNameStatus(name);
  if ("error" in result) {
    return Response.json({ ok: false, reason: result.error }, { status: 400 });
  }
  return Response.json({ ok: true, ...result });
}
