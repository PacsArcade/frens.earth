import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* API routes require a server runtime; the old `output: 'export'` static
     export is retired along with the Plesk deploy. */
  /* arcade-ui ships raw TS — Next transpiles it */
  transpilePackages: ["@pacsarcade/arcade-ui"],
};

export default nextConfig;
