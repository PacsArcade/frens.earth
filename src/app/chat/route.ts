import { frenFromRequest } from "@/lib/fren-auth";
import { effectiveChatNode, CHAT_URL_DEFAULT } from "@/lib/nodeconfig";

/**
 * /chat — the fren gate in front of the floor. The chat node itself is never
 * exposed to the anonymous public: a signed-in fren bounces (307) on to the
 * configured orbee door (`effectiveChatNode()` — stored config → env →
 * default), anyone else meets /login. chat.frens.earth points at THIS app
 * (next.config.ts rewrites the host's root here), so the gate runs before
 * any door opens — the arcade redirects its chat host straight out; ours
 * checks who's knocking first.
 */

function hostOf(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const fren = frenFromRequest(request);
  if (!fren) {
    return Response.redirect(new URL("/login", request.url), 307);
  }

  const node = await effectiveChatNode();
  const nodeHost = hostOf(node.url);
  const selfHost = new URL(request.url).host.toLowerCase();

  /* Loop guard — honest, not clever. The default node URL is the door domain
     itself (chat.frens.earth), and that DNS now lands on this very app: a
     redirect there would chase its own tail. Same if an operator points the
     node at whatever host is serving this page. In both cases the truth is
     "no real floor is linked yet" — say so (house rule: honest empty states). */
  if (!nodeHost || nodeHost === selfHost || nodeHost === hostOf(CHAT_URL_DEFAULT)) {
    return new Response(unpointedFloor(fren.handle), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return Response.redirect(node.url, 307);
}

/* The honest state, self-contained (a route handler carries no app CSS):
   frens-earth theme colors, terminal type, no pretend shelf. */
function unpointedFloor(handle: string): string {
  const safe = handle.replace(/[^a-z0-9-]/gi, "");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>CHAT — frens.earth</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         background: #0d1210; color: rgba(255,255,255,.8);
         font-family: ui-monospace, Menlo, Consolas, monospace; }
  main { max-width: 34rem; padding: 2rem; border: 2px solid #2f4033;
         background: #151d18; }
  h1 { margin: 0 0 .75rem; font-size: 1rem; letter-spacing: .2em;
       text-transform: uppercase; color: #53e0d4; }
  p { margin: .5rem 0; font-size: .8rem; line-height: 1.6; }
  a { color: #53e0d4; }
  .dim { color: rgba(255,255,255,.4); font-size: .65rem;
         text-transform: uppercase; letter-spacing: .15em; }
</style>
</head>
<body>
<main>
  <p class="dim">FRENS.EARTH ▸ CHAT</p>
  <h1>The floor isn&#8217;t pointed yet</h1>
  <p>You&#8217;re signed in, @${safe} — the gate knows you. But no chat node is
     linked to this deployment, so there&#8217;s no floor to open. No pretend
     doors here.</p>
  <p class="dim">Operators: point the orbee node at <a href="/a/chat">/a/chat</a>.</p>
  <p><a href="/">&#8592; back to frens.earth</a></p>
</main>
</body>
</html>`;
}
