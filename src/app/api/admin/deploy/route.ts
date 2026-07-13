import { operatorFromCookieHeader } from "@/lib/operator-auth";
import {
  deployHookConfigured,
  setDeployHook,
  isValidDeployHook,
  authorizeDeploy,
  listDeploys,
} from "@/lib/deploy";

export const dynamic = "force-dynamic";

/* SHIP — the signed deploy-to-production lane. Operator-gated both ways (the
   cookie opens the room); the POST additionally verifies the per-action deploy
   signature inside authorizeDeploy (the signature is what turns main into
   production). Two POST shapes: `hook` = the one-time write-only connect,
   `event` = a signed ship. */
export async function GET(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  return Response.json({
    ok: true,
    configured: await deployHookConfigured(),
    deploys: await listDeploys(),
  });
}

export async function POST(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  let body: { hook?: unknown; event?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }

  /* the one-time connect — paste the Vercel Deploy Hook URL, stored write-only.
     Validated as a Vercel deploy-hook URL before it ever lands in the vault. */
  if (typeof body.hook === "string") {
    if (!isValidDeployHook(body.hook)) {
      return Response.json(
        {
          ok: false,
          reason:
            "that isn't a Vercel deploy hook — expected https://api.vercel.com/…/deploy/…",
        },
        { status: 400 },
      );
    }
    const saved = await setDeployHook(body.hook);
    return Response.json({ ok: saved, configured: saved });
  }

  /* a signed ship — verified inside (shape → freshness → allowlist →
     signature), then the hook fires and the ship is recorded to the signer. */
  const result = await authorizeDeploy(body.event as Parameters<typeof authorizeDeploy>[0]);
  return Response.json(result, { status: result.ok ? 200 : 403 });
}
