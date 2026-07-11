import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* API routes require a server runtime; the old `output: 'export'` static
     export is retired along with the Plesk deploy. */
  /* arcade-ui ships raw TS — Next transpiles it */
  transpilePackages: ["@pacsarcade/arcade-ui"],
  /* stamped once per BUILD — SCARLET compares it to a signature's timestamp
     to answer "is the change I signed live yet?" (deploys are CLI-pushed,
     so a new build IS the deploy) */
  env: {
    NEXT_PUBLIC_BUILD_AT: new Date().toISOString(),
  },
  async rewrites() {
    return {
      /* chat.frens.earth = the DOOR, and the door is GATED. The arcade
         redirects chat.pacsarcade.org straight out to orbee; ours REWRITES
         to /chat so the fren-session gate (src/app/chat/route.ts) runs
         first — signed-in frens bounce on to the configured node, anonymous
         visitors meet /login. DNS: chat.frens.earth must point at the
         frens-earth Vercel project.

         beforeFiles because "/" already has a page — the host check must
         win. Root only, deliberately: /login and /api must keep working on
         the chat host or nobody could ever get through the gate there. */
      beforeFiles: [
        {
          source: "/",
          has: [{ type: "host", value: "chat.frens.earth" }],
          destination: "/chat",
        },
      ],
      afterFiles: [],
      /* Anything on the chat host that isn't a real route lands at the gate
         instead of a 404 — deep links from the old direct-door era included. */
      fallback: [
        {
          source: "/:path*",
          has: [{ type: "host", value: "chat.frens.earth" }],
          destination: "/chat",
        },
      ],
    };
  },
};

export default nextConfig;
