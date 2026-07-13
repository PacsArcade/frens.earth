import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { listBriefs, recordReview, pullBriefsFromRepo } from "@/lib/briefs";
import { effectiveGithub, effectiveBriefsRepo } from "@/lib/nodeconfig";

export const dynamic = "force-dynamic";

/* The briefs library — the design briefs as reviewable tickets. Operator-gated
   both ways: the cookie opens the room; POST additionally verifies the signed
   review action inside the store (the console's signed-action model). The brief
   CONTENT lives only in the dual-driver store, never in this public repo. */
export async function GET(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  const [{ token }, { repo, branch }] = await Promise.all([effectiveGithub(), effectiveBriefsRepo()]);
  return Response.json({
    ok: true,
    briefs: await listBriefs(),
    // the source (write-only token is masked to a boolean, like the nodes GET)
    source: { repo, branch, tokenSet: !!token },
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

  /* pull the briefs from the private repo (cookie-gated: it only reads a repo
     the connected token already grants). Honest state comes back in `reason`. */
  if (body.pull === true) {
    const result = await pullBriefsFromRepo();
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
