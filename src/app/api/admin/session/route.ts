import {
  verifyOperatorLogin,
  makeOperatorToken,
  operatorFromCookieHeader,
  operatorsConfigured,
  isOperatorNpub,
  OPERATOR_COOKIE,
} from "@/lib/operator-auth";
import { frenFromRequest } from "@/lib/fren-auth";
import { getEntry } from "@/lib/registry";

/* Who am I — the admin pages check this on load. `eligible` says the signed-in
   fren's KEY is on the operator allowlist even when no operator session exists
   yet — the menu shows the admiral their door; the gate still takes a fresh
   signature to open it. */
export async function GET(request: Request) {
  const operator = operatorFromCookieHeader(request.headers.get("cookie"));
  if (!operator) {
    let eligible = false;
    const fren = frenFromRequest(request);
    if (fren) {
      const entry = await getEntry(fren.handle, fren.space);
      if (entry?.npub) eligible = isOperatorNpub(entry.npub);
    }
    return Response.json(
      { ok: false, configured: operatorsConfigured(), eligible },
      { status: 401 }
    );
  }
  return Response.json({ ok: true, operator });
}

/* Sign in: a fresh PACS-CONSOLE-<ts> challenge signed by an allowlisted key. */
export async function POST(request: Request) {
  let body: { event?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = verifyOperatorLogin(body.event as any);
  if (!result.ok) {
    return Response.json(result, { status: 403 });
  }
  const token = makeOperatorToken(result.pubkey);
  return Response.json(
    { ok: true, operator: result.pubkey },
    {
      headers: {
        "Set-Cookie": `${OPERATOR_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`,
      },
    }
  );
}
