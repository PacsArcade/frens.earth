import { verifyFrenLogin, makeFrenToken, frenFromRequest, FREN_COOKIE } from "@/lib/fren-auth";
import { getEntry } from "@/lib/registry";
import { spaceForHost } from "@/lib/identity-config";

/* Who am I — the header's FrenChip asks on every page load. npub rides
   along so the chip can tune the fren's kind-0 picture from the relays. */
export async function GET(request: Request) {
  const fren = frenFromRequest(request);
  if (!fren) return Response.json({ ok: false }, { status: 401 });
  const entry = await getEntry(fren.handle, fren.space);
  return Response.json({ ok: true, ...fren, npub: entry?.npub ?? null });
}

/* Sign in: a fresh PACS-LOGIN-<ts> challenge signed by a key that owns a tag. */
export async function POST(request: Request) {
  let body: { event?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }
  /* the host decides the preferred door — pacsarcade.org logins land the
     school tag when a key holds both */
  const preferred = spaceForHost(request.headers.get("host")).space;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await verifyFrenLogin(body.event as any, preferred);
  if (!result.ok) {
    return Response.json(result, { status: 403 });
  }
  const token = makeFrenToken(result.handle, result.space);
  const entry = await getEntry(result.handle, result.space);
  return Response.json(
    { ok: true, handle: result.handle, space: result.space, npub: entry?.npub ?? null },
    {
      headers: {
        "Set-Cookie": `${FREN_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
      },
    }
  );
}

/* Sign out — the cookie dies, nothing else existed. */
export async function DELETE() {
  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `${FREN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
      },
    }
  );
}
