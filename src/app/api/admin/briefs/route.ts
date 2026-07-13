import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { listBriefs, recordReview, pullAllBriefs } from "@/lib/briefs";
import { effectiveGithub, effectiveBriefsRepo, effectiveSharedBriefsRepo } from "@/lib/nodeconfig";

export const dynamic = "force-dynamic";

/* The briefs library — the design briefs as reviewable tickets, in two tiers:
   SHARED (public source, no token) + PERSONAL (private source, token).
   Operator-gated both ways: the cookie opens the room; POST additionally
   verifies the signed review action inside the store (the console's
   signed-action model). Brief CONTENT lives only in the dual-driver store,
   never in this public repo — for either tier. */
export async function GET(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  const [{ token }, personal, shared] = await Promise.all([
    effectiveGithub(),
    effectiveBriefsRepo(),
    effectiveSharedBriefsRepo(),
  ]);
  return Response.json({
    ok: true,
    briefs: await listBriefs(),
    // the sources readout (write-only token masked to a boolean, like nodes GET)
    sources: {
      shared: { repo: shared.repo, branch: shared.branch }, // public — no token
      personal: { repo: personal.repo, branch: personal.branch, tokenSet: !!token },
    },
  });
}

export async function POST(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  let body: { pull?: boolean; review?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }

  /* pull BOTH sources — shared (public, no token) + personal (private, token).
     Cookie-gated; each source reports its own honest status in `reason`. The
     overall status is 200 if EITHER source landed briefs. */
  if (body.pull === true) {
    const result = await pullAllBriefs();
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }

  /* a signed review — sign-off or send-back, verified inside the store */
  if (body.review) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await recordReview(body.review as any);
    return Response.json(result, { status: result.ok ? 200 : 403 });
  }

  return Response.json({ ok: false, reason: "nothing to do — send a review or a pull" }, { status: 400 });
}
