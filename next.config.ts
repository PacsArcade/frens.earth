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
};

export default nextConfig;
