import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { readNodeConfig, writeNodeConfig, type NodeConfig } from "@/lib/nodeconfig";

export const dynamic = "force-dynamic";

/* Node links, from the GUI — the admiral edits their own server connections
   on /a/spaces and /a/mud. Tokens are write-only: the GET masks them (set or
   not-set), so a stored secret never round-trips to the browser. */

function masked(c: NodeConfig) {
  return {
    spacesUrl: c.spacesUrl,
    spacesTokenSet: !!c.spacesToken,
    mudUrl: c.mudUrl,
    mudTokenSet: !!c.mudToken,
    chatUrl: c.chatUrl,
    githubRepo: c.githubRepo,
    githubTokenSet: !!c.githubToken || !!process.env.GITHUB_TOKEN?.trim(),
    briefsRepo: c.briefsRepo, // owner/name, not a secret — no masking
    briefsBranch: c.briefsBranch,
    // write-only, like githubToken: report SET/not-set only, never the value
    briefsTokenSet: !!c.briefsToken || !!process.env.BRIEFS_TOKEN?.trim(),
    sharedBriefsRepo: c.sharedBriefsRepo, // owner/name, not a secret — no masking
    sharedBriefsBranch: c.sharedBriefsBranch,
    mempoolUrl: c.mempoolUrl, // a URL, not a secret — no masking
    ceremony: c.ceremony,
    envFallback: {
      spacesUrl: process.env.SPACES_NODE_URL?.trim() || null,
      mudUrl: process.env.MUD_NODE_URL?.trim() || null,
      chatUrl: process.env.CHAT_NODE_URL?.trim() || null,
      mempoolUrl: process.env.MEMPOOL_NODE_URL?.trim() || null,
    },
  };
}

export async function GET(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  return Response.json({ ok: true, config: masked(await readNodeConfig()) });
}

export async function PUT(request: Request) {
  if (!operatorFromCookieHeader(request.headers.get("cookie"))) {
    return Response.json({ ok: false, reason: "operator sign-in required" }, { status: 401 });
  }
  let body: Partial<NodeConfig>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }
  const patch: Partial<NodeConfig> = {};
  if (typeof body.spacesUrl === "string") patch.spacesUrl = body.spacesUrl.trim();
  if (typeof body.spacesToken === "string") patch.spacesToken = body.spacesToken.trim();
  if (typeof body.mudUrl === "string") patch.mudUrl = body.mudUrl.trim();
  if (typeof body.mudToken === "string") patch.mudToken = body.mudToken.trim();
  if (typeof body.chatUrl === "string") patch.chatUrl = body.chatUrl.trim();
  if (typeof body.githubToken === "string") patch.githubToken = body.githubToken.trim();
  if (typeof body.githubRepo === "string") patch.githubRepo = body.githubRepo.trim();
  if (typeof body.briefsRepo === "string") patch.briefsRepo = body.briefsRepo.trim();
  if (typeof body.briefsBranch === "string") patch.briefsBranch = body.briefsBranch.trim();
  if (typeof body.briefsToken === "string") patch.briefsToken = body.briefsToken.trim();
  if (typeof body.sharedBriefsRepo === "string") patch.sharedBriefsRepo = body.sharedBriefsRepo.trim();
  if (typeof body.sharedBriefsBranch === "string") patch.sharedBriefsBranch = body.sharedBriefsBranch.trim();
  if (typeof body.mempoolUrl === "string") patch.mempoolUrl = body.mempoolUrl.trim();
  if (body.ceremony && typeof body.ceremony === "object") {
    patch.ceremony = {
      certTemplate: String(body.ceremony.certTemplate ?? "").slice(0, 60) || "bft-auto",
      welcomeMessage: String(body.ceremony.welcomeMessage ?? "").slice(0, 2000),
    };
  }
  const next = await writeNodeConfig(patch);
  return Response.json({ ok: true, config: masked(next) });
}
