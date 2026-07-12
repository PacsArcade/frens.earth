import { operatorFromCookieHeader } from "@/lib/operator-auth";
import {
  listOpenPrs,
  listPrFiles,
  getPrBrief,
  listAuthorizations,
  authorizeMerge,
  closeAuthorization,
  mergeExecutionEnabled,
  postNote,
  tokenExpiration,
} from "@/lib/merges";

export const dynamic = "force-dynamic";

/* The merge queue — open PRs joined with their signed authorizations.
   Operator-gated both ways; the POST additionally verifies the per-action
   signature inside (the cookie opens the room, the signature moves the ship). */
export async function GET(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  /* ?brief=N — the PR's own title+body (what to test, in the change's words) */
  const briefFor = new URL(request.url).searchParams.get("brief");
  if (briefFor) {
    try {
      const brief = await getPrBrief(Number(briefFor));
      return Response.json({ ok: true, ...brief });
    } catch {
      return Response.json({ ok: false, reason: "couldn't read the brief — see it on GitHub" });
    }
  }
  /* ?files=N — the change list for one proposal (the captain's review) */
  const filesFor = new URL(request.url).searchParams.get("files");
  if (filesFor) {
    try {
      return Response.json({ ok: true, files: await listPrFiles(Number(filesFor)) });
    } catch {
      return Response.json({ ok: false, reason: "couldn't read the change list — review on GitHub" });
    }
  }
  const auths = await listAuthorizations();
  const canExecute = await mergeExecutionEnabled();
  try {
    const prs = await listOpenPrs();
    return Response.json({ ok: true, canExecute, prs, auths, tokenExpiresAt: tokenExpiration() });
  } catch (err) {
    /* Private repo without a token (404), rate limit, or GitHub down — the
       lane still opens with the connect box + the audit log intact. */
    return Response.json({
      ok: true,
      canExecute,
      prs: [],
      auths,
      setup: canExecute
        ? `couldn't reach GitHub (${err instanceof Error ? err.message : "error"}) — try again`
        : "connect-github",
    });
  }
}

export async function POST(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  let body: { event?: unknown; close?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }
  /* the close-out — cookie-gated (low stakes: it only ends the watch) */
  if (typeof body.close === "number") {
    return Response.json({ ok: await closeAuthorization(body.close) });
  }
  /* a signed review note — verified inside (same ladder as the merge
     authorization), recorded, and posted to GitHub when a token is on */
  if (body.note) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noted = await postNote(body.note as any);
    return Response.json(noted, { status: noted.ok ? 200 : 403 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await authorizeMerge(body.event as any);
  return Response.json(result, { status: result.ok ? 200 : 403 });
}
