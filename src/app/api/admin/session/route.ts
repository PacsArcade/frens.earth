import {
  verifyOperatorLogin,
  makeOperatorToken,
  operatorFromCookieHeader,
  operatorsConfigured,
  OPERATOR_COOKIE,
} from "@/lib/operator-auth";

/* Who am I — the admin pages check this on load. */
export async function GET(request: Request) {
  const operator = operatorFromCookieHeader(request.headers.get("cookie"));
  if (!operator) {
    return Response.json({ ok: false, configured: operatorsConfigured() }, { status: 401 });
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
        "Set-Cookie": `${OPERATOR_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`,
      },
    }
  );
}
