import { claimHandle } from "@/lib/registry";

export async function POST(request: Request) {
  let body: { handle?: string; npub?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }

  if (typeof body.handle !== "string" || typeof body.npub !== "string") {
    return Response.json({ ok: false, reason: "handle and npub required" }, { status: 400 });
  }

  const result = await claimHandle(body.handle, body.npub);
  if (!result.ok) {
    return Response.json(result, { status: 409 });
  }
  return Response.json(result);
}
