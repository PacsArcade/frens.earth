import {
  verifyFrenLogin,
  makeFrenToken,
  sessionsFromRequest,
  joinSessionTokens,
  FREN_COOKIE,
} from "@/lib/fren-auth";
import { getEntry } from "@/lib/registry";
import { OPERATOR_COOKIE } from "@/lib/operator-auth";
import { spaceForHost } from "@/lib/identity-config";

function sessionCookie(value: string, maxAge: number): HeadersInit {
  return {
    "Set-Cookie": `${FREN_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`,
  };
}

/* Who am I — the header's FrenChip asks on every page load. npub rides
   along so the chip can tune the fren's kind-0 picture; `accounts` lists
   every door signed in on this browser (first = active). */
export async function GET(request: Request) {
  const sessions = sessionsFromRequest(request);
  if (!sessions.length) return Response.json({ ok: false }, { status: 401 });
  const active = sessions[0];
  const entry = await getEntry(active.handle, active.space);
  return Response.json({
    ok: true,
    handle: active.handle,
    space: active.space,
    npub: entry?.npub ?? null,
    accounts: sessions.map((s) => ({ handle: s.handle, space: s.space })),
  });
}

/* Sign in: a fresh PACS-LOGIN-<ts> challenge signed by a key that owns a
   tag. New sessions JOIN the cookie (the door switcher) — the fresh login
   becomes the active door, earlier doors stay signed in. */
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
  const others = sessionsFromRequest(request)
    .filter((s) => !(s.handle === result.handle && s.space === result.space))
    .map((s) => s.token);
  const entry = await getEntry(result.handle, result.space);
  const accounts = [
    { handle: result.handle, space: result.space },
    ...sessionsFromRequest(request)
      .filter((s) => !(s.handle === result.handle && s.space === result.space))
      .map((s) => ({ handle: s.handle, space: s.space })),
  ];
  return Response.json(
    { ok: true, handle: result.handle, space: result.space, npub: entry?.npub ?? null, accounts },
    { headers: sessionCookie(joinSessionTokens([token, ...others]), 2592000) }
  );
}

/* Switch doors — no fresh signature needed when the browser already holds a
   session for the tag, OR when the requested tag is owned by the same npub
   as a signed-in tag (the key already proved itself once). */
export async function PUT(request: Request) {
  let body: { handle?: string; space?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }
  const handle = (body.handle ?? "").trim().toLowerCase();
  const space = (body.space ?? "").trim().toLowerCase();
  if (!handle || !space) {
    return Response.json({ ok: false, reason: "handle and space required" }, { status: 400 });
  }

  const sessions = sessionsFromRequest(request);
  if (!sessions.length) {
    return Response.json({ ok: false, reason: "sign in first, fren" }, { status: 401 });
  }

  let tokens: string[] | null = null;
  const existing = sessions.find((s) => s.handle === handle && s.space === space);
  if (existing) {
    /* already signed in — just move it to the front */
    tokens = [existing.token, ...sessions.filter((s) => s !== existing).map((s) => s.token)];
  } else {
    /* same-key door: the requested tag must belong to an npub that already
       has a live session in this browser */
    const target = await getEntry(handle, space);
    if (target) {
      for (const s of sessions) {
        const owned = await getEntry(s.handle, s.space);
        if (owned?.npub && owned.npub === target.npub) {
          tokens = [makeFrenToken(handle, space), ...sessions.map((x) => x.token)];
          break;
        }
      }
    }
  }
  if (!tokens) {
    return Response.json(
      { ok: false, reason: "that door needs its own key — sign in with it once" },
      { status: 403 }
    );
  }

  const entry = await getEntry(handle, space);
  const seen = new Set<string>();
  const accounts = [{ handle, space }, ...sessions.map((s) => ({ handle: s.handle, space: s.space }))].filter(
    (a) => {
      const k = `${a.handle}@${a.space}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }
  );
  return Response.json(
    { ok: true, handle, space, npub: entry?.npub ?? null, accounts },
    { headers: sessionCookie(joinSessionTokens(tokens), 2592000) }
  );
}

/* Sign out — every door at once (that's the promise in the confirm),
   INCLUDING the operator deck. The admiral's catch (0018.04.15 a₿): the
   30-day fe-operator cookie outlived sign-out, so ⚓ ADMIN DECK kept
   showing after the key was removed. Sign out means all the way out. */
export async function DELETE() {
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `${FREN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
  headers.append(
    "Set-Cookie",
    `${OPERATOR_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
  );
  return Response.json({ ok: true }, { headers });
}
